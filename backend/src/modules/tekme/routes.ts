import { VrstaTekmovanja, type Prisma } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';
import { dan } from '../../common/datumi.js';
import { konflikt, napakaPolja } from '../../common/errors.js';
import { asinh, idIzPoti, zBesedilo, zDatumInUra, zId } from '../../common/http.js';
import { pogojVidnosti, sezonaZaDan, trenutni, zahtevajVlogo } from '../../common/pravice.js';
import { prisma } from '../../common/prisma.js';
import { zahtevajAktivnoEkipo } from '../ekipe/routes.js';
import { izpisTekem, naloziTekmo, zEkipoInKlubom } from './skupno.js';

// Podatki, ki jih vnese vodja ekipe (US-09, AC 1). Rezultata, postave in dogodkov tu ni – te vnese trener v poročilu.
const tekmaShema = z.object({
  nasprotniKlubId: zId,
  datumInUra: zDatumInUra,
  jeDomaca: z.boolean({ required_error: 'Izberite, ali je tekma domača ali gostujoča', invalid_type_error: 'Izberite, ali je tekma domača ali gostujoča' }),
  lokacija: zBesedilo(1, 100),
  vrstaTekmovanja: z.nativeEnum(VrstaTekmovanja, { errorMap: () => ({ message: 'Izberite vrsto tekmovanja' }) }),
});
const novaTekmaShema = tekmaShema.extend({ ekipaId: zId });

const seznamShema = z.object({
  ekipaId: zId.optional(),
  obdobje: z.enum(['prihajajoce', 'pretekle']).default('prihajajoce'),
});

async function preveriPodatke(podatki: z.infer<typeof tekmaShema>) {
  if (podatki.datumInUra < new Date()) throw napakaPolja('datumInUra', 'Datum in ura tekme ne smeta biti v preteklosti');
  if (!(await prisma.nasprotniKlub.findUnique({ where: { id: podatki.nasprotniKlubId } }))) {
    throw napakaPolja('nasprotniKlubId', 'Izberite nasprotni klub iz evidence');
  }
  const sezona = await sezonaZaDan(dan(podatki.datumInUra));
  if (!sezona) throw napakaPolja('datumInUra', 'Za izbrani datum ni določene tekmovalne sezone');
  return sezona;
}

export const tekmeRouter = Router();

tekmeRouter.get(
  '/',
  asinh(async (req, res) => {
    const uporabnik = trenutni(req);
    const { ekipaId, obdobje } = seznamShema.parse(req.query);
    const zdaj = new Date();
    const tekme = await prisma.tekma.findMany({
      where: {
        ...(await pogojVidnosti(uporabnik, 'datumInUra')),
        ...(ekipaId ? { ekipaId } : {}),
        datumInUra: obdobje === 'prihajajoce' ? { gte: zdaj } : { lt: zdaj },
      } as Prisma.TekmaWhereInput,
      include: zEkipoInKlubom,
      orderBy: { datumInUra: obdobje === 'prihajajoce' ? 'asc' : 'desc' },
      take: 100,
    });
    res.json(await izpisTekem(uporabnik, tekme));
  }),
);

tekmeRouter.get(
  '/:id',
  asinh(async (req, res) => {
    const tekma = await naloziTekmo(req, idIzPoti(req));
    const [izpis] = await izpisTekem(trenutni(req), [tekma]);
    res.json(izpis);
  }),
);

tekmeRouter.post(
  '/',
  asinh(async (req, res) => {
    const podatki = novaTekmaShema.parse(req.body);
    // Vodja ekipe lahko ustvari tekmo samo za ekipe, v katerih ima to vlogo (US-09, AC 5).
    await zahtevajVlogo(req, podatki.ekipaId, 'VODJA_EKIPE');
    await zahtevajAktivnoEkipo(podatki.ekipaId);
    const sezona = await preveriPodatke(podatki);

    const tekma = await prisma.tekma.create({ data: { ...podatki, sezonaId: sezona.id }, include: zEkipoInKlubom });
    const [izpis] = await izpisTekem(trenutni(req), [tekma]);
    res.status(201).json(izpis);
  }),
);

// Urejanje in odpoved sta mogoča, dokler ima tekma status »Načrtovana« (US-09, AC 3).
tekmeRouter.patch(
  '/:id',
  asinh(async (req, res) => {
    const tekma = await naloziTekmo(req, idIzPoti(req));
    await zahtevajVlogo(req, tekma.ekipaId, 'VODJA_EKIPE');
    if (tekma.status !== 'NACRTOVANA') throw konflikt('Urejati je mogoče samo načrtovano tekmo');
    const podatki = tekmaShema.parse(req.body);
    const sezona = await preveriPodatke(podatki);

    const posodobljena = await prisma.tekma.update({
      where: { id: tekma.id },
      data: { ...podatki, sezonaId: sezona.id },
      include: zEkipoInKlubom,
    });
    const [izpis] = await izpisTekem(trenutni(req), [posodobljena]);
    res.json(izpis);
  }),
);

tekmeRouter.post(
  '/:id/odpovej',
  asinh(async (req, res) => {
    const tekma = await naloziTekmo(req, idIzPoti(req));
    await zahtevajVlogo(req, tekma.ekipaId, 'VODJA_EKIPE');
    if (tekma.status !== 'NACRTOVANA') throw konflikt('Odpovedati je mogoče samo načrtovano tekmo');

    const odpovedana = await prisma.tekma.update({ where: { id: tekma.id }, data: { status: 'ODPOVEDANA' }, include: zEkipoInKlubom });
    const [izpis] = await izpisTekem(trenutni(req), [odpovedana]);
    res.json(izpis);
  }),
);
