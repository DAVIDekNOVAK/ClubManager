import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { z } from 'zod';
import { HttpNapaka } from './errors.js';

/** Ovije asinhrono funkcijo, da zavrnjena obljuba pride do skupne obravnave napak. */
export const asinh =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    fn(req, res, next).catch(next);
  };

/** Prebere celoštevilski parameter poti (npr. `/ekipe/:id`). */
export function idIzPoti(req: Request, ime = 'id'): number {
  const vrednost = Number(req.params[ime]);
  if (!Number.isInteger(vrednost) || vrednost <= 0) {
    throw new HttpNapaka(400, `Parameter »${ime}« ni veljaven`);
  }
  return vrednost;
}

/** Gradniki za validacijo, ki se ponavljajo v več modulih. */
export const zId = z.coerce.number({ invalid_type_error: 'Polje je obvezno' }).int().positive('Polje je obvezno');
export const zDatum = z
  .string({ required_error: 'Polje je obvezno' })
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Datum mora biti v obliki LLLL-MM-DD')
  .refine((v) => !Number.isNaN(Date.parse(`${v}T00:00:00Z`)), 'Datum ni veljaven')
  .transform((v) => new Date(`${v}T00:00:00Z`));
export const zDatumInUra = z
  .string({ required_error: 'Polje je obvezno' })
  .refine((v) => !Number.isNaN(Date.parse(v)), 'Datum in ura nista veljavna')
  .transform((v) => new Date(v));
export const zBesedilo = (min: number, max: number, obvezno = 'Polje je obvezno') =>
  z
    .string({ required_error: obvezno, invalid_type_error: obvezno })
    .trim()
    .min(min, min <= 1 ? obvezno : `Najmanjše število znakov: ${min}`)
    .max(max, `Dovoljenih je največ ${max} znakov`);
