import type { Vloga } from '@prisma/client';
import type { Request, RequestHandler } from 'express';
import { dan } from './datumi.js';
import { neprijavljen, prepovedano } from './errors.js';
import { asinh } from './http.js';
import { prisma } from './prisma.js';

export interface PrijavljenUporabnik {
  id: number;
  ime: string;
  priimek: string;
  ePosta: string;
  jeAdministrator: boolean;
}

declare module 'express-serve-static-core' {
  interface Request {
    uporabnik?: PrijavljenUporabnik;
  }
}

/** Zahteva veljavno sejo in v `req.uporabnik` naloži prijavljenega uporabnika (sicer 401). */
export const zahtevajPrijavo: RequestHandler = asinh(async (req, _res, next) => {
  const id = req.session.uporabnikId;
  if (!id) throw neprijavljen();
  const uporabnik = await prisma.uporabnik.findUnique({
    where: { id },
    select: { id: true, ime: true, priimek: true, ePosta: true, jeAdministrator: true },
  });
  if (!uporabnik) throw neprijavljen();
  req.uporabnik = uporabnik;
  next();
});

/** Dovoli samo administratorju kluba (sicer 403). Uporabi se za `zahtevajPrijavo`. */
export const zahtevajAdministratorja: RequestHandler = (req, _res, next) => {
  if (!req.uporabnik) return next(neprijavljen());
  if (!req.uporabnik.jeAdministrator) return next(prepovedano());
  next();
};

/** Prijavljeni uporabnik zahteve; vrže 401, če ga ni. */
export function trenutni(req: Request): PrijavljenUporabnik {
  if (!req.uporabnik) throw neprijavljen();
  return req.uporabnik;
}

/** Pogoj za članstvo, ki velja na izbrani dan (uporabnik se je že pridružil in še ni odšel). */
export const veljaNaDan = (naDan: Date) => ({
  datumPridruzitve: { lte: naDan },
  OR: [{ datumOdhoda: null }, { datumOdhoda: { gte: naDan } }],
});

/**
 * Vloge, ki jih ima uporabnik trenutno v ekipi. Upoštevajo se članstva, iz katerih
 * uporabnik še ni odšel, v vseh sezonah – trener tako ohrani dostop do pretekle sezone.
 */
export async function vlogeVEkipi(uporabnikId: number, ekipaId: number): Promise<Set<Vloga>> {
  const danes = dan();
  const vloge = await prisma.vlogaClana.findMany({
    where: {
      clanstvo: { uporabnikId, ekipaId, OR: [{ datumOdhoda: null }, { datumOdhoda: { gte: danes } }] },
    },
    select: { vloga: true },
  });
  return new Set(vloge.map((v) => v.vloga));
}

export async function imaVlogo(uporabnikId: number, ekipaId: number, ...vloge: Vloga[]): Promise<boolean> {
  const moje = await vlogeVEkipi(uporabnikId, ekipaId);
  return vloge.some((v) => moje.has(v));
}

/** Vrže 403, če prijavljeni uporabnik v ekipi nima nobene od zahtevanih vlog. */
export async function zahtevajVlogo(req: Request, ekipaId: number, ...vloge: Vloga[]): Promise<void> {
  const uporabnik = trenutni(req);
  if (!(await imaVlogo(uporabnik.id, ekipaId, ...vloge))) throw prepovedano();
}

/** Kot `zahtevajVlogo`, le da ima dostop tudi administrator (samo za pregledovanje). */
export async function zahtevajVlogoAliAdmina(req: Request, ekipaId: number, ...vloge: Vloga[]): Promise<void> {
  if (trenutni(req).jeAdministrator) return;
  await zahtevajVlogo(req, ekipaId, ...vloge);
}

/** Ali je uporabnik (kadarkoli) član ekipe – za dostop do branja podatkov ekipe. */
export async function jeClanEkipe(uporabnikId: number, ekipaId: number): Promise<boolean> {
  return (await prisma.clanstvoVEkipi.count({ where: { uporabnikId, ekipaId } })) > 0;
}

/** Id-ji ekip, v katerih ima uporabnik trenutno eno od navedenih vlog. */
export async function ekipeZVlogo(uporabnikId: number, ...vloge: Vloga[]): Promise<number[]> {
  const danes = dan();
  const clanstva = await prisma.clanstvoVEkipi.findMany({
    where: {
      uporabnikId,
      OR: [{ datumOdhoda: null }, { datumOdhoda: { gte: danes } }],
      vloge: { some: { vloga: { in: vloge } } },
    },
    select: { ekipaId: true },
  });
  return [...new Set(clanstva.map((c) => c.ekipaId))];
}

/** Igralci z veljavnim članstvom v ekipi in sezoni na izbrani dan. */
export async function veljavniIgralci(ekipaId: number, sezonaId: number, naDan: Date) {
  const clanstva = await prisma.clanstvoVEkipi.findMany({
    where: { ekipaId, sezonaId, ...veljaNaDan(naDan), vloge: { some: { vloga: 'IGRALEC' } } },
    select: { uporabnik: { select: { id: true, ime: true, priimek: true } } },
    orderBy: [{ uporabnik: { priimek: 'asc' } }, { uporabnik: { ime: 'asc' } }],
  });
  return clanstva.map((c) => c.uporabnik);
}

/** Sezona, v katero spada izbrani dan. */
export function sezonaZaDan(naDan: Date) {
  return prisma.sezona.findFirst({ where: { datumZacetka: { lte: naDan }, datumKonca: { gte: naDan } } });
}
