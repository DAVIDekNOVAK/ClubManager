import { Vloga } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';
import { dan } from '../../common/datumi.js';
import { konflikt, napakaPolja, niNajdeno, prepovedano } from '../../common/errors.js';
import { asinh, idIzPoti, zDatum, zId } from '../../common/http.js';
import { imaVlogo, jeClanEkipe, trenutni, zahtevajAdministratorja } from '../../common/pravice.js';
import { prisma } from '../../common/prisma.js';
import { poPriimku } from '../../common/razvrsti.js';

const zVloge = z
  .array(z.nativeEnum(Vloga), { required_error: 'Izberite vsaj eno vlogo', invalid_type_error: 'Izberite vsaj eno vlogo' })
  .min(1, 'Izberite vsaj eno vlogo')
  .transform((v) => [...new Set(v)]);

const novoClanstvoShema = z.object({
  uporabnikId: zId,
  ekipaId: zId,
  sezonaId: zId,
  vloge: zVloge,
  datumPridruzitve: zDatum,
});

const urediClanstvoShema = z.object({
  datumOdhoda: zDatum.nullable().optional(),
  vloge: zVloge.optional(),
});

const izpis = {
  id: true,
  ekipaId: true,
  sezonaId: true,
  datumPridruzitve: true,
  datumOdhoda: true,
  uporabnik: { select: { id: true, ime: true, priimek: true, ePosta: true } },
  vloge: { select: { vloga: true } },
} as const;

/** Člani ekipe v izbrani sezoni: `GET /api/ekipe/:id/clanstva?sezonaId=`. */
export const clanstvaEkipe = asinh(async (req, res) => {
  const uporabnik = trenutni(req);
  const ekipaId = idIzPoti(req);
  const sezonaId = zId.parse(req.query.sezonaId);
  if (!(await prisma.ekipa.findUnique({ where: { id: ekipaId } }))) throw niNajdeno('Ekipa');
  if (!uporabnik.jeAdministrator && !(await jeClanEkipe(uporabnik.id, ekipaId))) throw prepovedano();

  // E-poštne naslove članov vidijo samo administrator, trener in vodja ekipe.
  const vidiEPosto = uporabnik.jeAdministrator || (await imaVlogo(uporabnik.id, ekipaId, 'TRENER', 'VODJA_EKIPE'));
  const danes = dan();
  const clanstva = await prisma.clanstvoVEkipi.findMany({ where: { ekipaId, sezonaId }, select: izpis });
  res.json(
    clanstva
      .map((c) => ({
        ...c,
        uporabnik: { ...c.uporabnik, ePosta: vidiEPosto ? c.uporabnik.ePosta : undefined },
        vloge: c.vloge.map((v) => v.vloga),
        jeOdsel: c.datumOdhoda !== null && c.datumOdhoda < danes,
      }))
      .sort((a, b) => poPriimku(a.uporabnik, b.uporabnik)),
  );
});

export const clanstvaRouter = Router();

clanstvaRouter.post(
  '/',
  zahtevajAdministratorja,
  asinh(async (req, res) => {
    const podatki = novoClanstvoShema.parse(req.body);

    const [uporabnik, ekipa, sezona] = await Promise.all([
      prisma.uporabnik.findUnique({ where: { id: podatki.uporabnikId } }),
      prisma.ekipa.findUnique({ where: { id: podatki.ekipaId } }),
      prisma.sezona.findUnique({ where: { id: podatki.sezonaId } }),
    ]);
    if (!uporabnik) throw napakaPolja('uporabnikId', 'Izbrani uporabnik ne obstaja');
    if (!ekipa) throw napakaPolja('ekipaId', 'Izbrana ekipa ne obstaja');
    if (!sezona) throw napakaPolja('sezonaId', 'Izbrana sezona ne obstaja');
    if (ekipa.jeArhivirana) throw konflikt('V arhivirano ekipo ni mogoče dodajati članov');
    if (podatki.datumPridruzitve > sezona.datumKonca) {
      throw napakaPolja('datumPridruzitve', 'Datum pridružitve ne sme biti po koncu sezone');
    }

    // Isti uporabnik je lahko v ekipi in sezoni samo enkrat (US-03, AC 2).
    const obstojece = await prisma.clanstvoVEkipi.findUnique({
      where: {
        uporabnikId_ekipaId_sezonaId: {
          uporabnikId: podatki.uporabnikId,
          ekipaId: podatki.ekipaId,
          sezonaId: podatki.sezonaId,
        },
      },
    });
    if (obstojece) {
      const sporocilo = 'Uporabnik je že član te ekipe v izbrani sezoni';
      throw konflikt(sporocilo, { uporabnikId: sporocilo });
    }

    const clanstvo = await prisma.clanstvoVEkipi.create({
      data: {
        uporabnikId: podatki.uporabnikId,
        ekipaId: podatki.ekipaId,
        sezonaId: podatki.sezonaId,
        datumPridruzitve: podatki.datumPridruzitve,
        vloge: { create: podatki.vloge.map((vloga) => ({ vloga })) },
      },
      select: izpis,
    });
    res.status(201).json({ ...clanstvo, vloge: clanstvo.vloge.map((v) => v.vloga) });
  }),
);

// Sprememba vlog in vnos datuma odhoda. Članstvo se nikoli ne izbriše (US-03, AC 4).
clanstvaRouter.patch(
  '/:id',
  zahtevajAdministratorja,
  asinh(async (req, res) => {
    const id = idIzPoti(req);
    const podatki = urediClanstvoShema.parse(req.body);
    const clanstvo = await prisma.clanstvoVEkipi.findUnique({ where: { id } });
    if (!clanstvo) throw niNajdeno('Članstvo');
    if (podatki.datumOdhoda && podatki.datumOdhoda < clanstvo.datumPridruzitve) {
      throw napakaPolja('datumOdhoda', 'Datum odhoda ne sme biti pred datumom pridružitve');
    }

    const posodobljeno = await prisma.$transaction(async (tx) => {
      if (podatki.vloge) {
        await tx.vlogaClana.deleteMany({ where: { clanstvoId: id, vloga: { notIn: podatki.vloge } } });
        await tx.vlogaClana.createMany({
          data: podatki.vloge.map((vloga) => ({ clanstvoId: id, vloga })),
          skipDuplicates: true,
        });
      }
      return tx.clanstvoVEkipi.update({
        where: { id },
        data: podatki.datumOdhoda !== undefined ? { datumOdhoda: podatki.datumOdhoda } : {},
        select: izpis,
      });
    });
    res.json({ ...posodobljeno, vloge: posodobljeno.vloge.map((v) => v.vloga) });
  }),
);
