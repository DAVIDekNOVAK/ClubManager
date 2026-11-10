import type { Prisma, Tekma } from '@prisma/client';
import { z } from 'zod';
import { dan } from '../../common/datumi.js';
import { HttpNapaka, konflikt, neveljavno } from '../../common/errors.js';
import { zId } from '../../common/http.js';
import { veljavniIgralci } from '../../common/pravice.js';
import { prisma } from '../../common/prisma.js';
import { statusiNaDan } from '../razpolozljivost/skupno.js';

const zGoli = z
  .number({ invalid_type_error: 'Vnesite število golov' })
  .int('Število golov mora biti celo število')
  .min(0, 'Število golov ne more biti negativno')
  .max(99, 'Število golov je preveliko')
  .nullable();

export const nastopShema = z.object({
  igralecId: zId,
  zacetnaPostava: z.boolean(),
  // Odigrane minute: celo število od 0 do 120 (US-11, AC 4).
  odigraneMinute: z
    .number({ required_error: 'Vnesite odigrane minute', invalid_type_error: 'Vnesite odigrane minute' })
    .int('Odigrane minute morajo biti celo število od 0 do 120')
    .min(0, 'Odigrane minute morajo biti celo število od 0 do 120')
    .max(120, 'Odigrane minute morajo biti celo število od 0 do 120'),
});

export const porociloShema = z.object({
  nasiGoli: zGoli.default(null),
  goliNasprotnika: zGoli.default(null),
  nastopi: z.array(nastopShema).default([]),
  /** Igralci s statusom »Poškodovan« ali »Odsoten«, za katere je trener potrdil opozorilo. */
  potrjenaOpozorila: z.array(zId).default([]),
});
export type Porocilo = z.infer<typeof porociloShema>;

const IMENA_STATUSOV = { POSKODOVAN: 'Poškodovan', ODSOTEN: 'Odsoten' } as const;

/** Igralci, ki jih je mogoče izbrati v poročilo, z razpoložljivostjo na dan tekme (US-11, AC 2). */
export async function igralciZaPorocilo(tekma: Pick<Tekma, 'ekipaId' | 'sezonaId' | 'datumInUra'>) {
  const naDan = dan(tekma.datumInUra);
  const igralci = await veljavniIgralci(tekma.ekipaId, tekma.sezonaId, naDan);
  const statusi = await statusiNaDan(igralci.map((i) => i.id), naDan);
  return igralci.map((i) => {
    const status = statusi.get(i.id)!.status;
    return { igralecId: i.id, ime: i.ime, priimek: i.priimek, status, zahtevaPotrditev: status === 'POSKODOVAN' || status === 'ODSOTEN' };
  });
}

/**
 * Pravila, ki veljajo tudi za osnutek: v poročilu so samo igralci z veljavnim članstvom,
 * vsak največ enkrat, poškodovani/odsotni šele po potrditvi opozorila, v začetni postavi največ 11.
 */
export async function preveriNastope(tekma: Tekma, porocilo: Porocilo) {
  const igralci = await igralciZaPorocilo(tekma);
  const poId = new Map(igralci.map((i) => [i.igralecId, i]));
  const videni = new Set<number>();
  for (const n of porocilo.nastopi) {
    const igralec = poId.get(n.igralecId);
    if (!igralec) throw neveljavno('V poročilu so lahko samo igralci z veljavnim članstvom v ekipi na dan tekme');
    if (videni.has(n.igralecId)) throw neveljavno(`Igralec ${igralec.ime} ${igralec.priimek} je v poročilu naveden večkrat`);
    videni.add(n.igralecId);
    if (igralec.zahtevaPotrditev && !porocilo.potrjenaOpozorila.includes(n.igralecId)) {
      const status = IMENA_STATUSOV[igralec.status as keyof typeof IMENA_STATUSOV];
      throw neveljavno(
        `Igralec ${igralec.ime} ${igralec.priimek} ima na dan tekme status »${status}«. Izberete ga lahko šele po potrditvi opozorila.`,
        { opozorilo: String(n.igralecId) },
      );
    }
  }
  if (porocilo.nastopi.filter((n) => n.zacetnaPostava).length > 11) {
    throw neveljavno('V začetni postavi je lahko največ 11 igralcev');
  }
  return poId;
}

/** Pogoji za potrditev poročila; vrne seznam razlogov, zakaj poročila še ni mogoče potrditi. */
export function preveriPopolnost(porocilo: Porocilo): string[] {
  const napake: string[] = [];
  if (porocilo.nasiGoli === null || porocilo.goliNasprotnika === null) napake.push('Vnesite rezultat tekme');
  const zacetna = porocilo.nastopi.filter((n) => n.zacetnaPostava).length;
  // Začetna postava mora imeti natanko 11 igralcev (US-11, AC 3).
  if (zacetna !== 11) napake.push(`Začetna postava mora imeti natanko 11 igralcev (izbranih: ${zacetna})`);
  return napake;
}

export function zahtevajPopolnost(porocilo: Porocilo) {
  const napake = preveriPopolnost(porocilo);
  if (napake.length > 0) throw new HttpNapaka(409, napake.join('. '), { preverjanje: napake.join('\n') });
}

/** Trenutno shranjeno poročilo tekme (rezultat z vidika naše ekipe in nastopi). */
export async function preberiPorocilo(tekma: Tekma, tx: Prisma.TransactionClient = prisma) {
  const nastopi = await tx.nastopNaTekmi.findMany({
    where: { tekmaId: tekma.id },
    select: { igralecId: true, zacetnaPostava: true, odigraneMinute: true },
    orderBy: { id: 'asc' },
  });
  return {
    nasiGoli: tekma.jeDomaca ? tekma.domaciGoli : tekma.gostujociGoli,
    goliNasprotnika: tekma.jeDomaca ? tekma.gostujociGoli : tekma.domaciGoli,
    nastopi,
  };
}

/** Shrani poročilo kot celoto: rezultat in nastopi se zamenjajo z novimi. */
export async function shraniPorocilo(tx: Prisma.TransactionClient, tekma: Tekma, porocilo: Porocilo, status: Tekma['status']) {
  await tx.nastopNaTekmi.deleteMany({ where: { tekmaId: tekma.id } });
  await tx.nastopNaTekmi.createMany({
    data: porocilo.nastopi.map((n) => ({
      tekmaId: tekma.id,
      igralecId: n.igralecId,
      zacetnaPostava: n.zacetnaPostava,
      odigraneMinute: n.odigraneMinute,
    })),
  });
  return tx.tekma.update({
    where: { id: tekma.id },
    data: {
      status,
      domaciGoli: tekma.jeDomaca ? porocilo.nasiGoli : porocilo.goliNasprotnika,
      gostujociGoli: tekma.jeDomaca ? porocilo.goliNasprotnika : porocilo.nasiGoli,
    },
  });
}

/** Poročilo je mogoče urejati šele, ko ga trener odpre (status »Odigrana«). */
export function zahtevajOdprtoPorocilo(tekma: Tekma) {
  if (tekma.status === 'ZAKLJUCENA') throw konflikt('Poročilo je že potrjeno. Uporabite »Popravi poročilo«.');
  if (tekma.status !== 'ODIGRANA') throw konflikt('Poročilo je treba najprej odpreti');
}
