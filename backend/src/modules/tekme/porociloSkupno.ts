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

const zMinuta = z
  .number({ required_error: 'Vnesite minuto dogodka', invalid_type_error: 'Vnesite minuto dogodka' })
  .int('Minuta mora biti celo število od 1 do 120')
  .min(1, 'Minuta mora biti celo število od 1 do 120')
  .max(120, 'Minuta mora biti celo število od 1 do 120');

// Dogodek na tekmi (US-12, AC 1). Asistenca je del gola (`asistentId`), pri menjavi je `igralecId`
// igralec, ki zapusti igrišče, `vstopilIgralecId` pa igralec, ki vstopi.
export const dogodekShema = z.object({
  vrsta: z.enum(['GOL', 'RUMENI_KARTON', 'RDECI_KARTON', 'MENJAVA'], { errorMap: () => ({ message: 'Izberite vrsto dogodka' }) }),
  igralecId: zId,
  minuta: zMinuta,
  asistentId: zId.nullish().transform((v) => v ?? null),
  vstopilIgralecId: zId.nullish().transform((v) => v ?? null),
});
export type Dogodek = z.infer<typeof dogodekShema>;

export const porociloShema = z.object({
  nasiGoli: zGoli.default(null),
  goliNasprotnika: zGoli.default(null),
  nastopi: z.array(nastopShema).default([]),
  dogodki: z.array(dogodekShema).default([]),
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
export async function preveriPorocilo(tekma: Tekma, porocilo: Porocilo) {
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
  preveriDogodke(porocilo, poId);
  return poId;
}

/** Pravila za dogodke na tekmi (US-12). Veljajo tudi za osnutek, da se ne shranijo neskladni podatki. */
export function preveriDogodke(porocilo: Porocilo, igralci: Map<number, { ime: string; priimek: string }>) {
  const nastopi = new Map(porocilo.nastopi.map((n) => [n.igralecId, n]));
  const ime = (id: number) => {
    const i = igralci.get(id);
    return i ? `${i.ime} ${i.priimek}` : `Igralec ${id}`;
  };
  const dogodki = [...porocilo.dogodki].sort((a, b) => a.minuta - b.minuta);

  const naIgriscu = new Set(porocilo.nastopi.filter((n) => n.zacetnaPostava).map((n) => n.igralecId));
  const vstopili = new Set<number>();
  const izkljuceni = new Map<number, number>();

  for (const d of dogodki) {
    const udelezeni = [d.igralecId, d.asistentId, d.vstopilIgralecId].filter((id): id is number => id !== null);
    if (udelezeni.some((id) => !nastopi.has(id))) {
      throw neveljavno('Dogodek se lahko nanaša samo na igralce iz začetne postave ali s klopi');
    }
    // Igralec z rdečim kartonom po minuti izključitve ne more imeti novih dogodkov (AC 5).
    for (const id of udelezeni) {
      const izkljucen = izkljuceni.get(id);
      if (izkljucen !== undefined && d.minuta > izkljucen) {
        throw neveljavno(`${ime(id)} je bil v ${izkljucen}. minuti izključen, zato po tej minuti ne more imeti novih dogodkov`);
      }
    }

    if (d.vrsta === 'GOL') {
      // Asistence ne more imeti igralec, ki je dosegel gol (AC 3).
      if (d.asistentId !== null && d.asistentId === d.igralecId) {
        throw neveljavno('Asistence ne more imeti isti igralec, ki je dosegel gol');
      }
    } else if (d.asistentId !== null) {
      throw neveljavno('Asistenca je lahko vezana samo na gol');
    }

    if (d.vrsta === 'MENJAVA') {
      // Igralec, ki vstopi, mora biti na klopi in ne v začetni postavi (AC 4).
      if (d.vstopilIgralecId === null) throw neveljavno('Pri menjavi izberite igralca, ki vstopi');
      if (nastopi.get(d.vstopilIgralecId)!.zacetnaPostava) {
        throw neveljavno('Igralec, ki vstopi, mora biti na klopi in ne v začetni postavi');
      }
      if (vstopili.has(d.vstopilIgralecId)) throw neveljavno(`${ime(d.vstopilIgralecId)} je v igro že vstopil`);
      if (!naIgriscu.has(d.igralecId)) throw neveljavno(`${ime(d.igralecId)} ob menjavi v ${d.minuta}. minuti ni na igrišču`);
      naIgriscu.delete(d.igralecId);
      naIgriscu.add(d.vstopilIgralecId);
      vstopili.add(d.vstopilIgralecId);
    } else if (d.vstopilIgralecId !== null) {
      throw neveljavno('Igralca, ki vstopi, je mogoče navesti samo pri menjavi');
    }

    if (d.vrsta === 'RDECI_KARTON') {
      if (izkljuceni.has(d.igralecId)) throw neveljavno(`${ime(d.igralecId)} ima lahko samo en rdeči karton`);
      izkljuceni.set(d.igralecId, d.minuta);
    }
  }
}

/** Pogoji za potrditev poročila; vrne seznam razlogov, zakaj poročila še ni mogoče potrditi. */
export function preveriPopolnost(porocilo: Porocilo): string[] {
  const napake: string[] = [];
  if (porocilo.nasiGoli === null || porocilo.goliNasprotnika === null) napake.push('Vnesite rezultat tekme');
  const zacetna = porocilo.nastopi.filter((n) => n.zacetnaPostava).length;
  // Začetna postava mora imeti natanko 11 igralcev (US-11, AC 3).
  if (zacetna !== 11) napake.push(`Začetna postava mora imeti natanko 11 igralcev (izbranih: ${zacetna})`);
  // Število vnesenih golov naše ekipe se mora ujemati z rezultatom (US-12, AC 2).
  const goli = porocilo.dogodki.filter((d) => d.vrsta === 'GOL').length;
  if (porocilo.nasiGoli !== null && goli !== porocilo.nasiGoli) napake.push('Število golov se ne ujema z rezultatom');
  return napake;
}

export function zahtevajPopolnost(porocilo: Porocilo) {
  const napake = preveriPopolnost(porocilo);
  if (napake.length > 0) throw new HttpNapaka(409, napake.join('. '), { preverjanje: napake.join('\n') });
}

/** Trenutno shranjeno poročilo tekme (rezultat z vidika naše ekipe, nastopi in dogodki). */
export async function preberiPorocilo(tekma: Tekma, tx: Prisma.TransactionClient = prisma) {
  const nastopi = await tx.nastopNaTekmi.findMany({
    where: { tekmaId: tekma.id },
    select: { igralecId: true, zacetnaPostava: true, odigraneMinute: true },
    orderBy: { id: 'asc' },
  });
  const shranjeni = await tx.dogodekNaTekmi.findMany({
    where: { tekmaId: tekma.id, vrstaDogodka: { not: 'ASISTENCA' } },
    include: { asistence: { select: { igralecId: true } } },
    // Dogodki so prikazani kronološko po minuti (US-12, AC 1).
    orderBy: [{ minuta: 'asc' }, { id: 'asc' }],
  });
  const dogodki: Dogodek[] = shranjeni.map((d) => ({
    vrsta: d.vrstaDogodka as Dogodek['vrsta'],
    igralecId: d.igralecId,
    minuta: d.minuta,
    asistentId: d.asistence[0]?.igralecId ?? null,
    vstopilIgralecId: d.vstopilIgralecId,
  }));
  return {
    nasiGoli: tekma.jeDomaca ? tekma.domaciGoli : tekma.gostujociGoli,
    goliNasprotnika: tekma.jeDomaca ? tekma.gostujociGoli : tekma.domaciGoli,
    nastopi,
    dogodki,
  };
}

/** Shrani poročilo kot celoto: rezultat, nastopi in dogodki se zamenjajo z novimi. */
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
  await tx.dogodekNaTekmi.deleteMany({ where: { tekmaId: tekma.id } });
  for (const d of porocilo.dogodki) {
    const dogodek = await tx.dogodekNaTekmi.create({
      data: { tekmaId: tekma.id, vrstaDogodka: d.vrsta, igralecId: d.igralecId, minuta: d.minuta, vstopilIgralecId: d.vstopilIgralecId },
    });
    // Asistenca je samostojen dogodek, vezan na svoj gol (US-12, AC 3).
    if (d.vrsta === 'GOL' && d.asistentId !== null) {
      await tx.dogodekNaTekmi.create({
        data: { tekmaId: tekma.id, vrstaDogodka: 'ASISTENCA', igralecId: d.asistentId, minuta: d.minuta, golId: dogodek.id },
      });
    }
  }
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
