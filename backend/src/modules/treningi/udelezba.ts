import { RazlogOdsotnosti } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';
import { konflikt, prepovedano } from '../../common/errors.js';
import { asinh, idIzPoti } from '../../common/http.js';
import { trenutni } from '../../common/pravice.js';
import { prisma } from '../../common/prisma.js';
import { naloziTrening, uskladiPrisotnosti } from './skupno.js';

const udelezbaShema = z
  .object({
    odgovor: z.enum(['PRIDE', 'NE_PRIDE'], { errorMap: () => ({ message: 'Izberite »Pridem« ali »Ne pridem«' }) }),
    razlog: z.nativeEnum(RazlogOdsotnosti, { errorMap: () => ({ message: 'Izberite razlog odsotnosti' }) }).nullish(),
    komentar: z
      .string()
      .trim()
      .max(200, 'Komentar ima lahko največ 200 znakov')
      .nullish()
      .transform((v) => v || null),
  })
  // Ob odsotnosti je razlog obvezen (US-07, AC 2).
  .refine((u) => u.odgovor === 'PRIDE' || !!u.razlog, { path: ['razlog'], message: 'Izberite razlog odsotnosti' });

/** Potrjevanje udeležbe na treningu (US-07). */
export const udelezbaRouter = Router();

udelezbaRouter.put(
  '/:id/udelezba/:igralecId',
  asinh(async (req, res) => {
    const uporabnik = trenutni(req);
    // Igralec lahko potrjuje samo svojo udeležbo (US-07, AC 5).
    if (idIzPoti(req, 'igralecId') !== uporabnik.id) throw prepovedano('Potrdite lahko samo svojo udeležbo');

    const trening = await naloziTrening(req, idIzPoti(req));
    const podatki = udelezbaShema.parse(req.body);
    if (trening.status === 'ODPOVEDAN') throw konflikt('Trening je odpovedan, zato udeležbe ni mogoče potrditi');
    // Odgovor je mogoče spremeniti do začetka treninga (US-07, AC 3).
    if (trening.status === 'IZVEDEN' || new Date() >= trening.zacetek) {
      throw konflikt('Udeležbe po začetku treninga ni več mogoče spremeniti');
    }

    await uskladiPrisotnosti(trening);
    const kljuc = { treningId_igralecId: { treningId: trening.id, igralecId: uporabnik.id } };
    // Evidenco imajo samo igralci z veljavnim članstvom na dan treninga.
    if (!(await prisma.prisotnost.findUnique({ where: kljuc }))) {
      throw prepovedano('Udeležbo lahko potrdijo samo igralci ekipe');
    }

    const pride = podatki.odgovor === 'PRIDE';
    const prisotnost = await prisma.prisotnost.update({
      where: kljuc,
      data: {
        prijavljenaPrisotnost: podatki.odgovor,
        razlogOdsotnosti: pride ? null : podatki.razlog,
        komentar: pride ? null : podatki.komentar,
      },
      select: { prijavljenaPrisotnost: true, razlogOdsotnosti: true, komentar: true, dejanskaPrisotnost: true },
    });
    res.json(prisotnost);
  }),
);
