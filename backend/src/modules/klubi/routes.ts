import type { RequestHandler } from 'express';
import { Router } from 'express';
import { z } from 'zod';
import { konflikt, niNajdeno, prepovedano } from '../../common/errors.js';
import { asinh, idIzPoti, zBesedilo } from '../../common/http.js';
import { ekipeZVlogo, trenutni } from '../../common/pravice.js';
import { prisma } from '../../common/prisma.js';
import { poNazivu } from '../../common/razvrsti.js';

const klubShema = z.object({
  naziv: zBesedilo(2, 80),
  kraj: zBesedilo(1, 80),
});

/** Evidenco nasprotnih klubov vodi vodja ekipe (katere koli ekipe kluba). */
const zahtevajVodjoEkipe: RequestHandler = asinh(async (req, _res, next) => {
  if ((await ekipeZVlogo(trenutni(req).id, 'VODJA_EKIPE')).length === 0) throw prepovedano();
  next();
});

/** Kluba z enakim nazivom in krajem ni mogoče dodati dvakrat (US-10, AC 2). */
async function preveriPodvojenost(podatki: { naziv: string; kraj: string }, razenId?: number) {
  const obstojec = await prisma.nasprotniKlub.findFirst({
    where: {
      naziv: { equals: podatki.naziv, mode: 'insensitive' },
      kraj: { equals: podatki.kraj, mode: 'insensitive' },
      ...(razenId ? { id: { not: razenId } } : {}),
    },
  });
  if (obstojec) throw konflikt('Klub že obstaja v evidenci', { naziv: 'Klub že obstaja v evidenci' });
}

export const klubiRouter = Router();

// Seznam klubov; z `?iskanje=` vrne klube, katerih naziv vsebuje vneseno besedilo (vsaj 2 znaka, US-10 AC 3).
klubiRouter.get(
  '/',
  asinh(async (req, res) => {
    const iskanje = typeof req.query.iskanje === 'string' ? req.query.iskanje.trim() : undefined;
    if (iskanje !== undefined && iskanje.length < 2) {
      res.json([]);
      return;
    }
    const klubi = await prisma.nasprotniKlub.findMany({
      where: iskanje ? { naziv: { contains: iskanje, mode: 'insensitive' } } : {},
      include: { _count: { select: { tekme: true } } },
    });
    res.json(klubi.sort(poNazivu).map(({ _count, ...k }) => ({ ...k, steviloTekem: _count.tekme })));
  }),
);

klubiRouter.post(
  '/',
  zahtevajVodjoEkipe,
  asinh(async (req, res) => {
    const podatki = klubShema.parse(req.body);
    await preveriPodvojenost(podatki);
    const klub = await prisma.nasprotniKlub.create({ data: podatki });
    res.status(201).json({ ...klub, steviloTekem: 0 });
  }),
);

klubiRouter.patch(
  '/:id',
  zahtevajVodjoEkipe,
  asinh(async (req, res) => {
    const id = idIzPoti(req);
    const podatki = klubShema.parse(req.body);
    if (!(await prisma.nasprotniKlub.findUnique({ where: { id } }))) throw niNajdeno('Klub');
    await preveriPodvojenost(podatki, id);
    res.json(await prisma.nasprotniKlub.update({ where: { id }, data: podatki }));
  }),
);

klubiRouter.delete(
  '/:id',
  zahtevajVodjoEkipe,
  asinh(async (req, res) => {
    const id = idIzPoti(req);
    const klub = await prisma.nasprotniKlub.findUnique({ where: { id }, include: { _count: { select: { tekme: true } } } });
    if (!klub) throw niNajdeno('Klub');
    // Klub, ki je povezan s tekmo, ostane v evidenci – mogoče ga je samo urejati (US-10, AC 4).
    if (klub._count.tekme > 0) throw konflikt('Kluba, ki je povezan z vsaj eno tekmo, ni mogoče izbrisati');
    await prisma.nasprotniKlub.delete({ where: { id } });
    res.status(204).end();
  }),
);
