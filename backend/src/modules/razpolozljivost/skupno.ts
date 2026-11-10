import type { StatusRazpolozljivosti } from '@prisma/client';
import { veljavniIgralci } from '../../common/pravice.js';
import { prisma } from '../../common/prisma.js';

export interface StatusNaDan {
  status: StatusRazpolozljivosti;
  veljaOd: Date | null;
  veljaDo: Date | null;
}

const NA_VOLJO: StatusNaDan = { status: 'NA_VOLJO', veljaOd: null, veljaDo: null };

/**
 * Status razpoložljivosti igralcev na izbrani dan. Velja zadnji vneseni zapis, ki ta dan pokriva;
 * če ga ni (ali je njegov datum konca že potekel), je igralec »Na voljo« (US-16, AC 3).
 */
export async function statusiNaDan(igralecIds: number[], naDan: Date): Promise<Map<number, StatusNaDan>> {
  const zapisi = await prisma.razpolozljivostIgralca.findMany({
    where: {
      igralecId: { in: igralecIds },
      veljaOd: { lte: naDan },
      OR: [{ veljaDo: null }, { veljaDo: { gte: naDan } }],
    },
    orderBy: [{ ustvarjena: 'desc' }, { id: 'desc' }],
  });
  const statusi = new Map<number, StatusNaDan>();
  for (const id of igralecIds) statusi.set(id, NA_VOLJO);
  const obdelani = new Set<number>();
  for (const z of zapisi) {
    if (obdelani.has(z.igralecId)) continue;
    obdelani.add(z.igralecId);
    statusi.set(z.igralecId, { status: z.status, veljaOd: z.veljaOd, veljaDo: z.veljaDo });
  }
  return statusi;
}

/** Igralci ekipe z veljavnim članstvom na izbrani dan in njihov status ta dan, s povzetkom po statusih. */
export async function razpolozljivostEkipe(ekipaId: number, sezonaId: number, naDan: Date) {
  const igralci = await veljavniIgralci(ekipaId, sezonaId, naDan);
  const statusi = await statusiNaDan(igralci.map((i) => i.id), naDan);
  const povzetek: Record<StatusRazpolozljivosti, number> = { NA_VOLJO: 0, OMEJENO_TRENIRANJE: 0, POSKODOVAN: 0, ODSOTEN: 0 };
  const seznam = igralci.map((i) => {
    const s = statusi.get(i.id)!;
    povzetek[s.status] += 1;
    return { igralecId: i.id, ime: i.ime, priimek: i.priimek, ...s };
  });
  return { datum: naDan, igralci: seznam, povzetek };
}
