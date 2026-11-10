import { Vloga, type Povabilo } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';
import { dodajDni } from '../../common/datumi.js';
import { HttpNapaka, konflikt, napakaPolja, niNajdeno } from '../../common/errors.js';
import { asinh, idIzPoti, zId } from '../../common/http.js';
import { posljiPosto } from '../../common/posta.js';
import { trenutni, zahtevajAdministratorja } from '../../common/pravice.js';
import { prisma } from '../../common/prisma.js';
import { config } from '../../config.js';
import { novZeton, VELJAVNOST_DNI, zgostiZeton } from './zeton.js';

const IMENA_VLOG: Record<Vloga, string> = { IGRALEC: 'igralec', TRENER: 'trener', VODJA_EKIPE: 'vodja ekipe' };

export type StatusPovabila = 'POSLANO' | 'SPREJETO' | 'POTEKLO';

export function statusPovabila(p: Pick<Povabilo, 'datumPoteka' | 'datumSprejetja'>, zdaj = new Date()): StatusPovabila {
  if (p.datumSprejetja) return 'SPREJETO';
  return p.datumPoteka < zdaj ? 'POTEKLO' : 'POSLANO';
}

const novoPovabiloShema = z.object({
  ePosta: z
    .string({ required_error: 'Vnesite e-poštni naslov' })
    .trim()
    .toLowerCase()
    .email('Vnesite veljaven e-poštni naslov'),
  ekipaId: zId,
  sezonaId: zId,
  vloga: z.nativeEnum(Vloga, { errorMap: () => ({ message: 'Izberite vlogo' }) }),
});

const izpis = {
  id: true,
  ePosta: true,
  vloga: true,
  poslanoOb: true,
  datumPoteka: true,
  datumSprejetja: true,
  ekipa: { select: { id: true, naziv: true } },
  sezona: { select: { id: true, naziv: true } },
} as const;

async function posljiPovabilo(povabilo: { ePosta: string; vloga: Vloga; ekipa: { naziv: string }; datumPoteka: Date }, zeton: string) {
  const povezava = `${config.FRONTEND_URL}/povabilo/${zeton}`;
  const velja = new Intl.DateTimeFormat('sl-SI', { dateStyle: 'long', timeZone: 'Europe/Ljubljana' }).format(povabilo.datumPoteka);
  try {
    await posljiPosto({
      za: povabilo.ePosta,
      zadeva: `Povabilo v ClubManager – ekipa ${povabilo.ekipa.naziv}`,
      besedilo:
        `Pozdravljeni,\n\npovabljeni ste v aplikacijo ClubManager kot ${IMENA_VLOG[povabilo.vloga]} ekipe ${povabilo.ekipa.naziv}.\n\n` +
        `Račun ustvarite na povezavi:\n${povezava}\n\nPovezava je enkratna in velja do ${velja}.\n`,
      html:
        `<p>Pozdravljeni,</p><p>povabljeni ste v aplikacijo <strong>ClubManager</strong> kot ${IMENA_VLOG[povabilo.vloga]} ekipe ` +
        `<strong>${povabilo.ekipa.naziv}</strong>.</p><p><a href="${povezava}">Ustvari račun</a></p>` +
        `<p>Povezava je enkratna in velja do ${velja}.</p>`,
    });
  } catch (e) {
    console.error('Pošiljanje e-pošte ni uspelo:', e);
    throw new HttpNapaka(502, 'E-pošte ni bilo mogoče poslati. Preverite, ali poštni strežnik teče (docker compose up -d).');
  }
}

export const povabilaRouter = Router();
povabilaRouter.use(zahtevajAdministratorja);

povabilaRouter.get(
  '/',
  asinh(async (_req, res) => {
    const povabila = await prisma.povabilo.findMany({ select: izpis, orderBy: { poslanoOb: 'desc' } });
    res.json(povabila.map((p) => ({ ...p, status: statusPovabila(p) })));
  }),
);

povabilaRouter.post(
  '/',
  asinh(async (req, res) => {
    const podatki = novoPovabiloShema.parse(req.body);
    const zdaj = new Date();

    // Obstoječega uporabnika se ne vabi, ampak doda v ekipo (US-18, AC 3).
    if (await prisma.uporabnik.findUnique({ where: { ePosta: podatki.ePosta } })) {
      const sporocilo = 'Uporabnik že obstaja – dodajte ga v ekipo';
      throw konflikt(sporocilo, { ePosta: sporocilo });
    }
    const [ekipa, sezona] = await Promise.all([
      prisma.ekipa.findUnique({ where: { id: podatki.ekipaId } }),
      prisma.sezona.findUnique({ where: { id: podatki.sezonaId } }),
    ]);
    if (!ekipa || ekipa.jeArhivirana) throw napakaPolja('ekipaId', 'Izberite aktivno ekipo');
    if (!sezona) throw napakaPolja('sezonaId', 'Izbrana sezona ne obstaja');

    const veljavno = await prisma.povabilo.findFirst({
      where: { ePosta: podatki.ePosta, datumSprejetja: null, datumPoteka: { gt: zdaj } },
    });
    if (veljavno) {
      const sporocilo = 'Za ta e-poštni naslov že obstaja veljavno povabilo';
      throw konflikt(sporocilo, { ePosta: sporocilo });
    }

    const zeton = novZeton();
    const povabilo = await prisma.povabilo.create({
      data: {
        ...podatki,
        zgoscenaVrednostZetona: zgostiZeton(zeton),
        poslanoOb: zdaj,
        datumPoteka: dodajDni(zdaj, VELJAVNOST_DNI),
        ustvarilId: trenutni(req).id,
      },
      select: izpis,
    });
    try {
      await posljiPovabilo(povabilo, zeton);
    } catch (e) {
      // Brez poslane e-pošte povabilo nima smisla, zato ga ne obdržimo.
      await prisma.povabilo.delete({ where: { id: povabilo.id } });
      throw e;
    }
    res.status(201).json({ ...povabilo, status: statusPovabila(povabilo) });
  }),
);

// Ponovno pošiljanje: nov žeton in nov rok, stara povezava preneha veljati (US-18, AC 4).
povabilaRouter.post(
  '/:id/ponovi',
  asinh(async (req, res) => {
    const id = idIzPoti(req);
    const obstojece = await prisma.povabilo.findUnique({ where: { id } });
    if (!obstojece) throw niNajdeno('Povabilo');
    if (obstojece.datumSprejetja) throw konflikt('Povabilo je že sprejeto');
    if (await prisma.uporabnik.findUnique({ where: { ePosta: obstojece.ePosta } })) {
      throw konflikt('Uporabnik že obstaja – dodajte ga v ekipo');
    }

    const zdaj = new Date();
    const zeton = novZeton();
    const stanje = { zgoscenaVrednostZetona: obstojece.zgoscenaVrednostZetona, poslanoOb: obstojece.poslanoOb, datumPoteka: obstojece.datumPoteka };
    const povabilo = await prisma.povabilo.update({
      where: { id },
      data: { zgoscenaVrednostZetona: zgostiZeton(zeton), poslanoOb: zdaj, datumPoteka: dodajDni(zdaj, VELJAVNOST_DNI) },
      select: izpis,
    });
    try {
      await posljiPovabilo(povabilo, zeton);
    } catch (e) {
      await prisma.povabilo.update({ where: { id }, data: stanje });
      throw e;
    }
    res.json({ ...povabilo, status: statusPovabila(povabilo) });
  }),
);
