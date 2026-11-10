import type { Sezona } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';
import { dan } from '../../common/datumi.js';
import { konflikt } from '../../common/errors.js';
import { asinh, zBesedilo, zDatum } from '../../common/http.js';
import { zahtevajAdministratorja } from '../../common/pravice.js';
import { prisma } from '../../common/prisma.js';

export type StatusSezone = 'NACRTOVANA' | 'AKTIVNA' | 'ZAKLJUCENA';

/** Status sezone se izračuna iz datumov, zato se spremeni samodejno (US-01, AC 3). */
export function statusSezone(sezona: Pick<Sezona, 'datumZacetka' | 'datumKonca'>, naDan: Date = dan()): StatusSezone {
  if (naDan < sezona.datumZacetka) return 'NACRTOVANA';
  if (naDan > sezona.datumKonca) return 'ZAKLJUCENA';
  return 'AKTIVNA';
}

export const zStatusom = <T extends Pick<Sezona, 'datumZacetka' | 'datumKonca'>>(sezona: T) => ({
  ...sezona,
  status: statusSezone(sezona),
});

const novaSezonaShema = z
  .object({
    naziv: zBesedilo(1, 30),
    datumZacetka: zDatum,
    datumKonca: zDatum,
  })
  .refine((s) => s.datumKonca > s.datumZacetka, {
    path: ['datumKonca'],
    message: 'Datum konca mora biti kasnejši od datuma začetka',
  });

export const sezoneRouter = Router();

sezoneRouter.get(
  '/',
  asinh(async (_req, res) => {
    const sezone = await prisma.sezona.findMany({ orderBy: { datumZacetka: 'desc' } });
    res.json(sezone.map(zStatusom));
  }),
);

sezoneRouter.post(
  '/',
  zahtevajAdministratorja,
  asinh(async (req, res) => {
    const podatki = novaSezonaShema.parse(req.body);

    if (await prisma.sezona.findUnique({ where: { naziv: podatki.naziv } })) {
      throw konflikt('Sezona s tem nazivom že obstaja', { naziv: 'Sezona s tem nazivom že obstaja' });
    }
    // Obdobji se prekrivata, če se eno začne, preden se drugo konča (US-01, AC 2).
    const prekrivanje = await prisma.sezona.findFirst({
      where: { datumZacetka: { lte: podatki.datumKonca }, datumKonca: { gte: podatki.datumZacetka } },
      orderBy: { datumZacetka: 'asc' },
    });
    if (prekrivanje) {
      const sporocilo = `Obdobje se prekriva s sezono ${prekrivanje.naziv}`;
      throw konflikt(sporocilo, { datumZacetka: sporocilo });
    }

    const sezona = await prisma.sezona.create({ data: podatki });
    res.status(201).json(zStatusom(sezona));
  }),
);
