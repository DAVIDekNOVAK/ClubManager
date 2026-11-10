import { dan } from '../../common/datumi.js';
import { prisma } from '../../common/prisma.js';
import { poNazivu } from '../../common/razvrsti.js';

/** Podatki prijavljenega uporabnika z njegovimi članstvi in seznamom trenutnih ekip. */
export async function profilUporabnika(uporabnikId: number) {
  const uporabnik = await prisma.uporabnik.findUnique({
    where: { id: uporabnikId },
    select: {
      id: true,
      ime: true,
      priimek: true,
      ePosta: true,
      jeAdministrator: true,
      clanstva: {
        select: {
          id: true,
          datumPridruzitve: true,
          datumOdhoda: true,
          ekipa: { select: { id: true, naziv: true, kategorija: true, jeArhivirana: true } },
          sezona: { select: { id: true, naziv: true, datumZacetka: true, datumKonca: true } },
          vloge: { select: { vloga: true } },
        },
      },
    },
  });
  if (!uporabnik) return null;

  const danes = dan();
  const clanstva = uporabnik.clanstva
    .map((c) => ({
      ...c,
      vloge: c.vloge.map((v) => v.vloga),
      // Članstvo je aktivno, če uporabnik še ni odšel in sezona še ni končana.
      jeAktivno: (c.datumOdhoda === null || c.datumOdhoda >= danes) && c.sezona.datumKonca >= danes,
    }))
    // Najprej novejše sezone, znotraj sezone po nazivu ekipe.
    .sort((a, b) => b.sezona.datumZacetka.getTime() - a.sezona.datumZacetka.getTime() || poNazivu(a.ekipa, b.ekipa));

  // Trenutne ekipe uporabnika z združenimi vlogami (nadzorna plošča, US-20).
  const ekipe = new Map<number, { id: number; naziv: string; kategorija: string; jeArhivirana: boolean; vloge: string[] }>();
  for (const c of clanstva) {
    if (!c.jeAktivno) continue;
    const zapis = ekipe.get(c.ekipa.id) ?? { ...c.ekipa, vloge: [] };
    for (const v of c.vloge) if (!zapis.vloge.includes(v)) zapis.vloge.push(v);
    ekipe.set(c.ekipa.id, zapis);
  }

  return { ...uporabnik, clanstva, ekipe: [...ekipe.values()].sort(poNazivu) };
}
