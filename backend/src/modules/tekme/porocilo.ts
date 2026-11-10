import { Router } from 'express';
import { konflikt, prepovedano } from '../../common/errors.js';
import { asinh, idIzPoti } from '../../common/http.js';
import { imaVlogo, trenutni, zahtevajVlogo } from '../../common/pravice.js';
import { prisma } from '../../common/prisma.js';
import {
  igralciZaPorocilo, porociloShema, preberiPorocilo, preveriPorocilo, preveriPopolnost,
  shraniPorocilo, zahtevajOdprtoPorocilo, zahtevajPopolnost,
} from './porociloSkupno.js';
import { izpisTekem, naloziTekmo } from './skupno.js';

/** Poročilo o tekmi: rezultat, postava in minute (US-11) ter dogodki (US-12). */
export const porociloRouter = Router();

// Trener odpre poročilo po terminu tekme; tekma s tem dobi status »Odigrana« (US-11, AC 1).
porociloRouter.post(
  '/:id/porocilo/odpri',
  asinh(async (req, res) => {
    const tekma = await naloziTekmo(req, idIzPoti(req));
    await zahtevajVlogo(req, tekma.ekipaId, 'TRENER');
    if (tekma.status === 'ODPOVEDANA') throw konflikt('Tekma je odpovedana, zato poročila ni mogoče odpreti');
    if (new Date() < tekma.datumInUra) throw konflikt('Poročilo je mogoče odpreti šele po terminu tekme');
    if (tekma.status === 'NACRTOVANA') {
      await prisma.tekma.update({ where: { id: tekma.id }, data: { status: 'ODIGRANA' } });
    }
    res.json({ status: tekma.status === 'NACRTOVANA' ? 'ODIGRANA' : tekma.status });
  }),
);

porociloRouter.get(
  '/:id/porocilo',
  asinh(async (req, res) => {
    const uporabnik = trenutni(req);
    const tekma = await naloziTekmo(req, idIzPoti(req));
    const jeTrener = await imaVlogo(uporabnik.id, tekma.ekipaId, 'TRENER');
    // Osnutek vidi samo trener ekipe; zaključeno poročilo vidijo vsi člani ekipe.
    if (!jeTrener && !uporabnik.jeAdministrator && tekma.status !== 'ZAKLJUCENA') throw prepovedano();

    const [izpis] = await izpisTekem(uporabnik, [tekma]);
    const porocilo = await preberiPorocilo(tekma);
    res.json({
      tekma: izpis,
      ...porocilo,
      igralci: await igralciZaPorocilo(tekma),
      preverjanje: preveriPopolnost({ ...porocilo, potrjenaOpozorila: [] }),
    });
  }),
);

// Shranjevanje osnutka – poročilo je lahko še nepopolno (US-11, AC 5).
porociloRouter.put(
  '/:id/porocilo',
  asinh(async (req, res) => {
    const tekma = await naloziTekmo(req, idIzPoti(req));
    await zahtevajVlogo(req, tekma.ekipaId, 'TRENER');
    zahtevajOdprtoPorocilo(tekma);
    const porocilo = porociloShema.parse(req.body);
    await preveriPorocilo(tekma, porocilo);

    await prisma.$transaction((tx) => shraniPorocilo(tx, tekma, porocilo, 'ODIGRANA'));
    res.json({ status: 'ODIGRANA', preverjanje: preveriPopolnost(porocilo) });
  }),
);

// Potrditev: poročilo se shrani in tekma dobi status »Zaključena« (US-11, AC 5).
porociloRouter.post(
  '/:id/porocilo/potrdi',
  asinh(async (req, res) => {
    const tekma = await naloziTekmo(req, idIzPoti(req));
    await zahtevajVlogo(req, tekma.ekipaId, 'TRENER');
    zahtevajOdprtoPorocilo(tekma);
    const porocilo = porociloShema.parse(req.body);
    await preveriPorocilo(tekma, porocilo);
    zahtevajPopolnost(porocilo);

    await prisma.$transaction((tx) => shraniPorocilo(tx, tekma, porocilo, 'ZAKLJUCENA'));
    res.json({ status: 'ZAKLJUCENA' });
  }),
);
