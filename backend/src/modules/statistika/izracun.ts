import type { VrstaTekmovanja } from '@prisma/client';
import { dan } from '../../common/datumi.js';
import { prisma } from '../../common/prisma.js';

export interface StatistikaIgralca {
  nastopi: number;
  zacetnePostave: number;
  minute: number;
  goli: number;
  asistence: number;
  rumeniKartoni: number;
  rdeciKartoni: number;
  /** Izvedeni treningi v času igralčevega članstva in koliko jih je bil prisoten. */
  treningiIzvedeni: number;
  treningiPrisoten: number;
  /** Odstotek prisotnosti na treningih; `null`, če ni bilo izvedenih treningov. */
  prisotnost: number | null;
}

const prazna = (): StatistikaIgralca => ({
  nastopi: 0, zacetnePostave: 0, minute: 0, goli: 0, asistence: 0, rumeniKartoni: 0, rdeciKartoni: 0,
  treningiIzvedeni: 0, treningiPrisoten: 0, prisotnost: null,
});

export const imaPodatke = (s: StatistikaIgralca) => s.nastopi > 0 || s.zacetnePostave > 0 || s.treningiIzvedeni > 0;

/**
 * Statistika igralcev za sezono (in po želji ekipo). Nič ni shranjeno vnaprej – vse se izračuna
 * iz evidenc tekem in treningov (ADR-0006), zato popravek poročila takoj spremeni statistiko.
 */
export async function izracunajStatistiko(filter: { sezonaId: number; ekipaId?: number; igralecIds: number[]; vrstaTekmovanja?: VrstaTekmovanja }) {
  const { sezonaId, ekipaId, igralecIds, vrstaTekmovanja } = filter;
  const rezultat = new Map<number, StatistikaIgralca>(igralecIds.map((id) => [id, prazna()]));
  if (igralecIds.length === 0) return rezultat;

  // Upoštevajo se samo tekme s statusom »Zaključena«; osnutki poročil ne vplivajo (US-14, AC 4).
  const tekma = { sezonaId, status: 'ZAKLJUCENA' as const, ...(ekipaId ? { ekipaId } : {}), ...(vrstaTekmovanja ? { vrstaTekmovanja } : {}) };
  // Odpovedani in še neizvedeni treningi se ne štejejo (US-14, AC 3; US-06, AC 4).
  const trening = { sezonaId, status: 'IZVEDEN' as const, ...(ekipaId ? { ekipaId } : {}) };

  const [nastopi, dogodki, prisotnosti, clanstva] = await Promise.all([
    prisma.nastopNaTekmi.findMany({
      where: { igralecId: { in: igralecIds }, tekma },
      select: { igralecId: true, zacetnaPostava: true, odigraneMinute: true },
    }),
    prisma.dogodekNaTekmi.groupBy({
      by: ['igralecId', 'vrstaDogodka'],
      where: { igralecId: { in: igralecIds }, tekma, vrstaDogodka: { in: ['GOL', 'ASISTENCA', 'RUMENI_KARTON', 'RDECI_KARTON'] } },
      _count: { _all: true },
    }),
    prisma.prisotnost.findMany({
      where: { igralecId: { in: igralecIds }, dejanskaPrisotnost: { not: null }, trening },
      select: { igralecId: true, dejanskaPrisotnost: true, trening: { select: { ekipaId: true, zacetek: true } } },
    }),
    prisma.clanstvoVEkipi.findMany({
      where: { uporabnikId: { in: igralecIds }, sezonaId, ...(ekipaId ? { ekipaId } : {}) },
      select: { uporabnikId: true, ekipaId: true, datumPridruzitve: true, datumOdhoda: true },
    }),
  ]);

  for (const n of nastopi) {
    const s = rezultat.get(n.igralecId)!;
    // Nastop je tekma, na kateri je igralec dejansko igral; igralec, ki je ostal na klopi, nima nastopa.
    if (n.odigraneMinute > 0) s.nastopi += 1;
    if (n.zacetnaPostava) s.zacetnePostave += 1;
    s.minute += n.odigraneMinute;
  }
  for (const d of dogodki) {
    const s = rezultat.get(d.igralecId)!;
    if (d.vrstaDogodka === 'GOL') s.goli = d._count._all;
    if (d.vrstaDogodka === 'ASISTENCA') s.asistence = d._count._all;
    if (d.vrstaDogodka === 'RUMENI_KARTON') s.rumeniKartoni = d._count._all;
    if (d.vrstaDogodka === 'RDECI_KARTON') s.rdeciKartoni = d._count._all;
  }
  // Štejejo se treningi v času igralčevega članstva v ekipi.
  for (const p of prisotnosti) {
    const naDan = dan(p.trening.zacetek);
    const vCasuClanstva = clanstva.some(
      (c) =>
        c.uporabnikId === p.igralecId &&
        c.ekipaId === p.trening.ekipaId &&
        c.datumPridruzitve <= naDan &&
        (c.datumOdhoda === null || c.datumOdhoda >= naDan),
    );
    if (!vCasuClanstva) continue;
    const s = rezultat.get(p.igralecId)!;
    s.treningiIzvedeni += 1;
    if (p.dejanskaPrisotnost === 'PRISOTEN') s.treningiPrisoten += 1;
  }
  for (const s of rezultat.values()) {
    s.prisotnost = s.treningiIzvedeni > 0 ? Math.round((s.treningiPrisoten / s.treningiIzvedeni) * 100) : null;
  }
  return rezultat;
}
