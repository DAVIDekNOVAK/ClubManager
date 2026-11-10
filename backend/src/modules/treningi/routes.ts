import type { Prisma } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';
import { asinh, idIzPoti, zId } from '../../common/http.js';
import { pogojVidnosti, trenutni, zahtevajVlogo } from '../../common/pravice.js';
import { prisma } from '../../common/prisma.js';
import { zahtevajAktivnoEkipo } from '../ekipe/routes.js';
import { izpisTreningov, naloziTrening, preveriTermin, terminShema, uskladiPrisotnosti, zEkipo } from './skupno.js';

const novTreningShema = terminShema.extend({ ekipaId: zId });

const seznamShema = z.object({
  ekipaId: zId.optional(),
  obdobje: z.enum(['prihajajoci', 'pretekli']).default('prihajajoci'),
});

export const treningiRouter = Router();

// Razpored treningov uporabnika (ali izbrane ekipe).
treningiRouter.get(
  '/',
  asinh(async (req, res) => {
    const uporabnik = trenutni(req);
    const { ekipaId, obdobje } = seznamShema.parse(req.query);
    const zdaj = new Date();
    const treningi = await prisma.trening.findMany({
      where: {
        ...(await pogojVidnosti(uporabnik, 'zacetek')),
        ...(ekipaId ? { ekipaId } : {}),
        konec: obdobje === 'prihajajoci' ? { gte: zdaj } : { lt: zdaj },
      } as Prisma.TreningWhereInput,
      include: zEkipo,
      orderBy: { zacetek: obdobje === 'prihajajoci' ? 'asc' : 'desc' },
      take: 100,
    });
    res.json(await izpisTreningov(uporabnik, treningi));
  }),
);

treningiRouter.get(
  '/:id',
  asinh(async (req, res) => {
    const trening = await naloziTrening(req, idIzPoti(req));
    await uskladiPrisotnosti(trening);
    const zEkipoTrening = await prisma.trening.findUniqueOrThrow({ where: { id: trening.id }, include: zEkipo });
    const [izpis] = await izpisTreningov(trenutni(req), [zEkipoTrening]);
    res.json(izpis);
  }),
);

treningiRouter.post(
  '/',
  asinh(async (req, res) => {
    const uporabnik = trenutni(req);
    const podatki = novTreningShema.parse(req.body);
    // Trener lahko ustvari trening samo za ekipe, v katerih ima vlogo trenerja (US-05, AC 5).
    await zahtevajVlogo(req, podatki.ekipaId, 'TRENER');
    await zahtevajAktivnoEkipo(podatki.ekipaId);
    const sezona = await preveriTermin(podatki);

    const trening = await prisma.trening.create({
      data: { ...podatki, sezonaId: sezona.id, ustvarilId: uporabnik.id },
      include: zEkipo,
    });
    // Vsak igralec ekipe dobi evidenco s prijavo »Ni odgovora« (US-05, AC 4).
    await uskladiPrisotnosti(trening);

    const [izpis] = await izpisTreningov(uporabnik, [trening]);
    res.status(201).json(izpis);
  }),
);
