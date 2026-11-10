import { DejanskaPrisotnost, type PrijavljenaPrisotnost } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';
import { dan } from '../../common/datumi.js';
import { konflikt, neveljavno } from '../../common/errors.js';
import { asinh, idIzPoti, zId } from '../../common/http.js';
import { trenutni, veljavniIgralci, zahtevajVlogo, zahtevajVlogoAliAdmina } from '../../common/pravice.js';
import { prisma } from '../../common/prisma.js';
import { izpisTreningov, naloziTrening, uskladiPrisotnosti, zEkipo } from './skupno.js';

/** Predizpolnitev dejanske prisotnosti glede na prijavo igralca (US-08, AC 1). */
const PREDLOG: Record<PrijavljenaPrisotnost, DejanskaPrisotnost | null> = {
  PRIDE: 'PRISOTEN',
  NE_PRIDE: 'OPRAVICENO_ODSOTEN',
  NI_ODGOVORA: null,
};

const shraniShema = z.object({
  prisotnosti: z
    .array(
      z.object({
        igralecId: zId,
        dejanskaPrisotnost: z.nativeEnum(DejanskaPrisotnost, { errorMap: () => ({ message: 'Izberite prisotnost' }) }),
      }),
    )
    .min(1, 'Izberite prisotnost za vse igralce'),
});

/** Evidentiranje dejanske prisotnosti (US-08). */
export const prisotnostRouter = Router();

prisotnostRouter.get(
  '/:id/prisotnost',
  asinh(async (req, res) => {
    const trening = await naloziTrening(req, idIzPoti(req));
    await zahtevajVlogoAliAdmina(req, trening.ekipaId, 'TRENER');
    await uskladiPrisotnosti(trening);

    // Prikažejo se vsi igralci z veljavnim članstvom na dan treninga (US-08, AC 1).
    const [igralci, evidence, zgodovina, zEkipoTrening] = await Promise.all([
      veljavniIgralci(trening.ekipaId, trening.sezonaId, dan(trening.zacetek)),
      prisma.prisotnost.findMany({ where: { treningId: trening.id } }),
      prisma.zgodovinaPrisotnosti.findMany({
        where: { prisotnost: { treningId: trening.id } },
        orderBy: { datumSpremembe: 'desc' },
        select: {
          id: true,
          datumSpremembe: true,
          staraVrednost: true,
          novaVrednost: true,
          spremenil: { select: { ime: true, priimek: true } },
          prisotnost: { select: { igralec: { select: { ime: true, priimek: true } } } },
        },
      }),
      prisma.trening.findUniqueOrThrow({ where: { id: trening.id }, include: zEkipo }),
    ]);
    const poIgralcu = new Map(evidence.map((e) => [e.igralecId, e]));
    const [izpis] = await izpisTreningov(trenutni(req), [zEkipoTrening]);

    res.json({
      trening: izpis,
      igralci: igralci.map((i) => {
        const e = poIgralcu.get(i.id);
        const prijava = e?.prijavljenaPrisotnost ?? 'NI_ODGOVORA';
        return {
          igralecId: i.id,
          ime: i.ime,
          priimek: i.priimek,
          prijavljenaPrisotnost: prijava,
          razlogOdsotnosti: e?.razlogOdsotnosti ?? null,
          komentar: e?.komentar ?? null,
          dejanskaPrisotnost: e?.dejanskaPrisotnost ?? null,
          predlog: PREDLOG[prijava],
        };
      }),
      zgodovina: zgodovina.map((z) => ({
        id: z.id,
        datumSpremembe: z.datumSpremembe,
        staraVrednost: z.staraVrednost,
        novaVrednost: z.novaVrednost,
        spremenil: z.spremenil,
        igralec: z.prisotnost.igralec,
      })),
    });
  }),
);

prisotnostRouter.put(
  '/:id/prisotnost',
  asinh(async (req, res) => {
    const uporabnik = trenutni(req);
    const trening = await naloziTrening(req, idIzPoti(req));
    await zahtevajVlogo(req, trening.ekipaId, 'TRENER');
    const { prisotnosti } = shraniShema.parse(req.body);

    if (trening.status === 'ODPOVEDAN') throw konflikt('Trening je odpovedan, zato prisotnosti ni mogoče evidentirati');
    // Evidenco je mogoče shraniti šele po začetku treninga (US-08, AC 3).
    if (new Date() < trening.zacetek) throw konflikt('Evidenco je mogoče shraniti šele po začetku treninga');

    await uskladiPrisotnosti(trening);
    const igralci = await veljavniIgralci(trening.ekipaId, trening.sezonaId, dan(trening.zacetek));
    const novo = new Map(prisotnosti.map((p) => [p.igralecId, p.dejanskaPrisotnost]));
    const veljavniIds = new Set(igralci.map((i) => i.id));
    if ([...novo.keys()].some((id) => !veljavniIds.has(id))) {
      throw neveljavno('V evidenci so lahko samo igralci z veljavnim članstvom na dan treninga');
    }
    if (igralci.some((i) => !novo.has(i.id))) throw neveljavno('Izberite prisotnost za vse igralce');

    await prisma.$transaction(async (tx) => {
      const obstojece = await tx.prisotnost.findMany({ where: { treningId: trening.id, igralecId: { in: [...veljavniIds] } } });
      for (const e of obstojece) {
        const vrednost = novo.get(e.igralecId)!;
        if (e.dejanskaPrisotnost === vrednost) continue;
        await tx.prisotnost.update({ where: { id: e.id }, data: { dejanskaPrisotnost: vrednost } });
        // Vsak kasnejši popravek že shranjene vrednosti se zabeleži (US-08, AC 4).
        if (e.dejanskaPrisotnost !== null) {
          await tx.zgodovinaPrisotnosti.create({
            data: { prisotnostId: e.id, spremenilId: uporabnik.id, staraVrednost: e.dejanskaPrisotnost, novaVrednost: vrednost },
          });
        }
      }
      await tx.trening.update({ where: { id: trening.id }, data: { status: 'IZVEDEN' } });
    });

    res.json({ status: 'IZVEDEN' });
  }),
);
