import type { Prisma, Tekma } from '@prisma/client';
import type { Request } from 'express';
import { niNajdeno, prepovedano } from '../../common/errors.js';
import { ekipeZVlogo, pogojVidnosti, trenutni, type PrijavljenUporabnik } from '../../common/pravice.js';
import { prisma } from '../../common/prisma.js';

export const zEkipoInKlubom = {
  ekipa: { select: { id: true, naziv: true, jeArhivirana: true } },
  nasprotniKlub: { select: { id: true, naziv: true, kraj: true } },
} as const;

type TekmaZaIzpis = Tekma & {
  ekipa: { id: number; naziv: string; jeArhivirana: boolean };
  nasprotniKlub: { id: number; naziv: string; kraj: string };
};

/** Naloži tekmo, če jo uporabnik sme videti (sicer 404 oziroma 403). */
export async function naloziTekmo(req: Request, id: number) {
  const uporabnik = trenutni(req);
  const tekma = await prisma.tekma.findUnique({ where: { id }, include: zEkipoInKlubom });
  if (!tekma) throw niNajdeno('Tekma');
  const vidna = await prisma.tekma.findFirst({
    where: { id, ...(await pogojVidnosti(uporabnik, 'datumInUra')) } as Prisma.TekmaWhereInput,
    select: { id: true },
  });
  if (!vidna) throw prepovedano();
  return tekma;
}

/** Pripravi tekme za odgovor: doda pravice uporabnika in rezultat z vidika naše ekipe. */
export async function izpisTekem(uporabnik: PrijavljenUporabnik, tekme: TekmaZaIzpis[]) {
  const [trenerVEkipah, vodjaVEkipah] = await Promise.all([
    ekipeZVlogo(uporabnik.id, 'TRENER'),
    ekipeZVlogo(uporabnik.id, 'VODJA_EKIPE'),
  ]);
  const zdaj = new Date();
  return tekme.map((t) => {
    // Rezultat je javno viden šele pri zaključeni tekmi; osnutek poročila vidi samo trener.
    const zakljucena = t.status === 'ZAKLJUCENA' && t.domaciGoli !== null && t.gostujociGoli !== null;
    return {
      id: t.id,
      ekipa: t.ekipa,
      sezonaId: t.sezonaId,
      nasprotniKlub: t.nasprotniKlub,
      datumInUra: t.datumInUra,
      jeDomaca: t.jeDomaca,
      lokacija: t.lokacija,
      vrstaTekmovanja: t.vrstaTekmovanja,
      status: t.status,
      terminJeMinil: zdaj >= t.datumInUra,
      jeTrener: trenerVEkipah.includes(t.ekipaId),
      jeVodja: vodjaVEkipah.includes(t.ekipaId),
      rezultat: zakljucena
        ? {
            nasiGoli: t.jeDomaca ? t.domaciGoli! : t.gostujociGoli!,
            goliNasprotnika: t.jeDomaca ? t.gostujociGoli! : t.domaciGoli!,
          }
        : null,
    };
  });
}
