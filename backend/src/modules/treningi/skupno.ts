import type { Prisma, Trening } from '@prisma/client';
import type { Request } from 'express';
import { z } from 'zod';
import { dan } from '../../common/datumi.js';
import { napakaPolja, niNajdeno, prepovedano } from '../../common/errors.js';
import { zBesedilo, zDatumInUra } from '../../common/http.js';
import { ekipeZVlogo, pogojVidnosti, sezonaZaDan, trenutni, veljavniIgralci, type PrijavljenUporabnik } from '../../common/pravice.js';
import { prisma } from '../../common/prisma.js';

/** Polja termina, ki jih trener vnese ob ustvarjanju in spreminjanju treninga (US-05, US-06). */
export const terminShema = z.object({
  zacetek: zDatumInUra,
  konec: zDatumInUra,
  lokacija: zBesedilo(1, 100),
  vsebina: z
    .string()
    .trim()
    .max(500, 'Vsebina treninga ima lahko največ 500 znakov')
    .nullish()
    .transform((v) => v || null),
});

/** Preveri pravila termina in vrne sezono, v katero trening spada. */
export async function preveriTermin(termin: { zacetek: Date; konec: Date }) {
  if (termin.zacetek < new Date()) throw napakaPolja('zacetek', 'Datum in ura začetka ne smeta biti v preteklosti');
  if (termin.konec <= termin.zacetek) throw napakaPolja('konec', 'Ura konca mora biti kasneje od ure začetka');
  const sezona = await sezonaZaDan(dan(termin.zacetek));
  if (!sezona) throw napakaPolja('zacetek', 'Za izbrani datum ni določene tekmovalne sezone');
  return sezona;
}

/** Naloži trening, če ga uporabnik sme videti (sicer 404 oziroma 403). */
export async function naloziTrening(req: Request, id: number) {
  const uporabnik = trenutni(req);
  const trening = await prisma.trening.findUnique({ where: { id } });
  if (!trening) throw niNajdeno('Trening');
  const viden = await prisma.trening.findFirst({
    where: { id, ...(await pogojVidnosti(uporabnik, 'zacetek')) } as Prisma.TreningWhereInput,
    select: { id: true },
  });
  if (!viden) throw prepovedano();
  return trening;
}

/**
 * Poskrbi, da ima vsak igralec z veljavnim članstvom na dan treninga evidenco prisotnosti
 * (US-05, AC 4). Kliče se tudi kasneje, da evidenco dobijo igralci, dodani po nastanku treninga.
 */
export async function uskladiPrisotnosti(trening: Pick<Trening, 'id' | 'ekipaId' | 'sezonaId' | 'zacetek' | 'status'>) {
  if (trening.status === 'ODPOVEDAN') return;
  const igralci = await veljavniIgralci(trening.ekipaId, trening.sezonaId, dan(trening.zacetek));
  if (igralci.length === 0) return;
  await prisma.prisotnost.createMany({
    data: igralci.map((i) => ({ treningId: trening.id, igralecId: i.id })),
    skipDuplicates: true,
  });
}

export interface PovzetekPrijav {
  pride: number;
  nePride: number;
  niOdgovora: number;
}

/** Število igralcev, ki so potrdili udeležbo, so odsotni in še niso odgovorili (US-07, AC 4). */
export async function povzetkiPrijav(treningIds: number[]): Promise<Map<number, PovzetekPrijav>> {
  const skupine = await prisma.prisotnost.groupBy({
    by: ['treningId', 'prijavljenaPrisotnost'],
    where: { treningId: { in: treningIds } },
    _count: { _all: true },
  });
  const povzetki = new Map<number, PovzetekPrijav>();
  for (const id of treningIds) povzetki.set(id, { pride: 0, nePride: 0, niOdgovora: 0 });
  for (const s of skupine) {
    const p = povzetki.get(s.treningId)!;
    if (s.prijavljenaPrisotnost === 'PRIDE') p.pride = s._count._all;
    else if (s.prijavljenaPrisotnost === 'NE_PRIDE') p.nePride = s._count._all;
    else p.niOdgovora = s._count._all;
  }
  return povzetki;
}

type TreningZEkipo = Trening & { ekipa: { id: number; naziv: string; jeArhivirana: boolean } };

/** Pripravi treninge za odgovor: doda uporabnikovo prijavo, pravice in (za trenerja) povzetek prijav. */
export async function izpisTreningov(uporabnik: PrijavljenUporabnik, treningi: TreningZEkipo[]) {
  const ids = treningi.map((t) => t.id);
  const [trenerVEkipah, moje] = await Promise.all([
    ekipeZVlogo(uporabnik.id, 'TRENER'),
    prisma.prisotnost.findMany({
      where: { treningId: { in: ids }, igralecId: uporabnik.id },
      select: { treningId: true, prijavljenaPrisotnost: true, razlogOdsotnosti: true, komentar: true, dejanskaPrisotnost: true },
    }),
  ]);
  const mojePoTreningu = new Map(moje.map((m) => [m.treningId, m]));
  const vidiPovzetek = (t: TreningZEkipo) => uporabnik.jeAdministrator || trenerVEkipah.includes(t.ekipaId);
  const povzetki = await povzetkiPrijav(treningi.filter(vidiPovzetek).map((t) => t.id));
  const zdaj = new Date();

  return treningi.map((t) => {
    const { treningId: _, ...mojaPrisotnost } = mojePoTreningu.get(t.id) ?? { treningId: t.id };
    return {
      id: t.id,
      ekipa: t.ekipa,
      sezonaId: t.sezonaId,
      zacetek: t.zacetek,
      konec: t.konec,
      lokacija: t.lokacija,
      vsebina: t.vsebina,
      status: t.status,
      // Oznaka »Spremenjeno« je vidna do začetka treninga (US-06, AC 2).
      jeSpremenjen: t.status === 'NACRTOVAN' && t.spremenjenOb !== null && zdaj < t.zacetek,
      seJeZacel: zdaj >= t.zacetek,
      jeTrener: trenerVEkipah.includes(t.ekipaId),
      mojaPrisotnost: mojePoTreningu.has(t.id) ? mojaPrisotnost : null,
      povzetek: povzetki.get(t.id) ?? null,
    };
  });
}

export const zEkipo = { ekipa: { select: { id: true, naziv: true, jeArhivirana: true } } } as const;
