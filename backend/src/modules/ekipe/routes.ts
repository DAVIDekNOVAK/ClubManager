import { Kategorija } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';
import { dan } from '../../common/datumi.js';
import { konflikt, niNajdeno, prepovedano } from '../../common/errors.js';
import { asinh, idIzPoti, zBesedilo } from '../../common/http.js';
import { jeClanEkipe, trenutni, vlogeVEkipi, zahtevajAdministratorja } from '../../common/pravice.js';
import { prisma } from '../../common/prisma.js';
import { poNazivu } from '../../common/razvrsti.js';

const novaEkipaShema = z.object({
  naziv: zBesedilo(2, 50),
  kategorija: z.nativeEnum(Kategorija, { errorMap: () => ({ message: 'Izberite kategorijo' }) }),
});

/** Število trenutnih članov ekipe (članstva, ki še niso končana, v sezoni, ki še traja). */
async function steviloClanov(ekipaIds: number[]): Promise<Map<number, number>> {
  const danes = dan();
  const clanstva = await prisma.clanstvoVEkipi.findMany({
    where: {
      ekipaId: { in: ekipaIds },
      datumPridruzitve: { lte: danes },
      OR: [{ datumOdhoda: null }, { datumOdhoda: { gte: danes } }],
      sezona: { datumZacetka: { lte: danes }, datumKonca: { gte: danes } },
    },
    select: { ekipaId: true, uporabnikId: true },
    distinct: ['ekipaId', 'uporabnikId'],
  });
  const stevci = new Map<number, number>();
  for (const c of clanstva) stevci.set(c.ekipaId, (stevci.get(c.ekipaId) ?? 0) + 1);
  return stevci;
}

export const ekipeRouter = Router();

// Administrator vidi vse ekipe, ostali samo ekipe, v katerih so (bili) člani.
ekipeRouter.get(
  '/',
  asinh(async (req, res) => {
    const uporabnik = trenutni(req);
    const ekipe = await prisma.ekipa.findMany({
      where: {
        // Privzeto samo aktivne ekipe; filter »Arhivirane« prikaže arhivirane (US-04, AC 2).
        jeArhivirana: req.query.arhivirane === 'true',
        ...(uporabnik.jeAdministrator ? {} : { clanstva: { some: { uporabnikId: uporabnik.id } } }),
      },
    });
    ekipe.sort(poNazivu);
    const stevci = await steviloClanov(ekipe.map((e) => e.id));
    res.json(ekipe.map((e) => ({ ...e, steviloClanov: stevci.get(e.id) ?? 0 })));
  }),
);

ekipeRouter.get(
  '/:id',
  asinh(async (req, res) => {
    const uporabnik = trenutni(req);
    const id = idIzPoti(req);
    const ekipa = await prisma.ekipa.findUnique({ where: { id } });
    if (!ekipa) throw niNajdeno('Ekipa');
    if (!uporabnik.jeAdministrator && !(await jeClanEkipe(uporabnik.id, id))) throw prepovedano();
    res.json({ ...ekipa, mojeVloge: [...(await vlogeVEkipi(uporabnik.id, id))] });
  }),
);

ekipeRouter.post(
  '/',
  zahtevajAdministratorja,
  asinh(async (req, res) => {
    const podatki = novaEkipaShema.parse(req.body);
    await preveriUnikatenNaziv(podatki.naziv);
    const ekipa = await prisma.ekipa.create({ data: podatki });
    res.status(201).json({ ...ekipa, steviloClanov: 0 });
  }),
);

// Arhiviranje ekipe ne izbriše ničesar – treningi, tekme in statistika ostanejo (US-04, AC 4).
ekipeRouter.post(
  '/:id/arhiviraj',
  zahtevajAdministratorja,
  asinh(async (req, res) => {
    const id = idIzPoti(req);
    if (!(await prisma.ekipa.findUnique({ where: { id } }))) throw niNajdeno('Ekipa');
    res.json(await prisma.ekipa.update({ where: { id }, data: { jeArhivirana: true } }));
  }),
);

ekipeRouter.post(
  '/:id/aktiviraj',
  zahtevajAdministratorja,
  asinh(async (req, res) => {
    const id = idIzPoti(req);
    const ekipa = await prisma.ekipa.findUnique({ where: { id } });
    if (!ekipa) throw niNajdeno('Ekipa');
    // Med arhiviranjem je lahko nastala nova ekipa z enakim nazivom.
    await preveriUnikatenNaziv(ekipa.naziv, id);
    res.json(await prisma.ekipa.update({ where: { id }, data: { jeArhivirana: false } }));
  }),
);

/** Vrne ekipo, če obstaja in ni arhivirana; za arhivirano ekipo ni mogoče ustvarjati novih aktivnosti (US-04, AC 3). */
export async function zahtevajAktivnoEkipo(ekipaId: number) {
  const ekipa = await prisma.ekipa.findUnique({ where: { id: ekipaId } });
  if (!ekipa) throw niNajdeno('Ekipa');
  if (ekipa.jeArhivirana) throw konflikt('Ekipa je arhivirana, zato zanjo ni mogoče ustvarjati novih treningov in tekem');
  return ekipa;
}

/** Naziv mora biti unikaten med nearhiviranimi ekipami, ne glede na velike/male črke (US-02, AC 2). */
export async function preveriUnikatenNaziv(naziv: string, razenId?: number) {
  const obstojeca = await prisma.ekipa.findFirst({
    where: {
      naziv: { equals: naziv, mode: 'insensitive' },
      jeArhivirana: false,
      ...(razenId ? { id: { not: razenId } } : {}),
    },
  });
  if (obstojeca) {
    throw konflikt('Ekipa s tem nazivom že obstaja', { naziv: 'Ekipa s tem nazivom že obstaja' });
  }
}
