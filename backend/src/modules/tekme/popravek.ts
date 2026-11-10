import { Router } from 'express';
import { konflikt } from '../../common/errors.js';
import { z } from 'zod';
import { asinh, idIzPoti } from '../../common/http.js';
import { trenutni, zahtevajVlogo, zahtevajVlogoAliAdmina } from '../../common/pravice.js';
import { prisma } from '../../common/prisma.js';
import { porociloShema, preberiPorocilo, preveriPorocilo, shraniPorocilo, zahtevajPopolnost } from './porociloSkupno.js';
import { naloziTekmo } from './skupno.js';

// Razlog popravka je obvezen, 10–200 znakov (US-13, AC 2).
const zRazlog = z
  .string({ required_error: 'Vnesite razlog popravka', invalid_type_error: 'Vnesite razlog popravka' })
  .trim()
  .min(1, 'Vnesite razlog popravka')
  .min(10, 'Razlog popravka mora imeti vsaj 10 znakov')
  .max(200, 'Razlog popravka ima lahko največ 200 znakov');

type Posnetek = Awaited<ReturnType<typeof preberiPorocilo>>;

/** Kratek opis razlik med starim in novim poročilom za prikaz v zgodovini sprememb. */
function opisSprememb(staro: Posnetek, novo: Posnetek): string[] {
  const spremembe: string[] = [];
  if (staro.nasiGoli !== novo.nasiGoli || staro.goliNasprotnika !== novo.goliNasprotnika) {
    spremembe.push(`Rezultat (naši : nasprotnik): ${staro.nasiGoli} : ${staro.goliNasprotnika} → ${novo.nasiGoli} : ${novo.goliNasprotnika}`);
  }
  const kljucNastopa = (n: Posnetek['nastopi'][number]) => `${n.igralecId}/${n.zacetnaPostava}/${n.odigraneMinute}`;
  const stariNastopi = new Set(staro.nastopi.map(kljucNastopa));
  const noviNastopi = new Set(novo.nastopi.map(kljucNastopa));
  const razlikaNastopov = [...noviNastopi].filter((k) => !stariNastopi.has(k)).length + [...stariNastopi].filter((k) => !noviNastopi.has(k)).length;
  if (razlikaNastopov > 0) spremembe.push('Spremenjena postava ali odigrane minute');
  const kljucDogodka = (d: Posnetek['dogodki'][number]) => `${d.vrsta}/${d.igralecId}/${d.minuta}/${d.asistentId}/${d.vstopilIgralecId}`;
  const stariDogodki = staro.dogodki.map(kljucDogodka).sort().join('|');
  const noviDogodki = novo.dogodki.map(kljucDogodka).sort().join('|');
  if (stariDogodki !== noviDogodki) spremembe.push(`Spremenjeni dogodki (prej ${staro.dogodki.length}, zdaj ${novo.dogodki.length})`);
  return spremembe.length > 0 ? spremembe : ['Brez vsebinskih sprememb'];
}

/** Popravek zaključenega poročila in zgodovina sprememb tekme (US-13). */
export const popravekRouter = Router();

popravekRouter.put(
  '/:id/porocilo/popravek',
  asinh(async (req, res) => {
    const uporabnik = trenutni(req);
    const tekma = await naloziTekmo(req, idIzPoti(req));
    await zahtevajVlogo(req, tekma.ekipaId, 'TRENER');
    if (tekma.status !== 'ZAKLJUCENA') throw konflikt('Popraviti je mogoče samo zaključeno poročilo');

    const { razlog, ...telo } = porociloShema.extend({ razlog: zRazlog }).parse(req.body);
    await preveriPorocilo(tekma, telo);
    // Popravljeno poročilo mora izpolnjevati iste pogoje kot ob potrditvi.
    zahtevajPopolnost(telo);

    await prisma.$transaction(async (tx) => {
      const staro = await preberiPorocilo(tekma, tx);
      const posodobljena = await shraniPorocilo(tx, tekma, telo, 'ZAKLJUCENA');
      const novo = await preberiPorocilo(posodobljena, tx);
      // Sprememba ostane sledljiva: kdo, kdaj, razlog ter stari in novi podatki (AC 3).
      await tx.zgodovinaTekme.create({
        data: {
          tekmaId: tekma.id,
          spremenilId: uporabnik.id,
          vrstaSpremembe: 'POPRAVEK_POROCILA',
          razlog,
          stariPodatki: staro,
          noviPodatki: novo,
        },
      });
    });
    // Statistika se računa dinamično (ADR-0006), zato so spremenjene vrednosti vidne takoj (AC 4).
    res.json({ status: 'ZAKLJUCENA' });
  }),
);

// Zgodovino sprememb vidita trener ekipe in administrator, igralci pa ne (AC 5).
popravekRouter.get(
  '/:id/zgodovina',
  asinh(async (req, res) => {
    const tekma = await naloziTekmo(req, idIzPoti(req));
    await zahtevajVlogoAliAdmina(req, tekma.ekipaId, 'TRENER');
    const zapisi = await prisma.zgodovinaTekme.findMany({
      where: { tekmaId: tekma.id },
      orderBy: { datumSpremembe: 'desc' },
      include: { spremenil: { select: { ime: true, priimek: true } } },
    });
    res.json(
      zapisi.map((z) => ({
        id: z.id,
        datumSpremembe: z.datumSpremembe,
        spremenil: z.spremenil,
        razlog: z.razlog,
        stariPodatki: z.stariPodatki,
        noviPodatki: z.noviPodatki,
        spremembe: opisSprememb(z.stariPodatki as unknown as Posnetek, z.noviPodatki as unknown as Posnetek),
      })),
    );
  }),
);
