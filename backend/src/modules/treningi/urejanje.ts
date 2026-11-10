import { Router } from 'express';
import { konflikt } from '../../common/errors.js';
import { asinh, idIzPoti } from '../../common/http.js';
import { trenutni, zahtevajVlogo } from '../../common/pravice.js';
import { prisma } from '../../common/prisma.js';
import { izpisTreningov, naloziTrening, preveriTermin, terminShema, uskladiPrisotnosti, zEkipo } from './skupno.js';

/** Sprememba in odpoved treninga (US-06). */
export const urejanjeTreningovRouter = Router();

urejanjeTreningovRouter.patch(
  '/:id',
  asinh(async (req, res) => {
    const trening = await naloziTrening(req, idIzPoti(req));
    await zahtevajVlogo(req, trening.ekipaId, 'TRENER');
    // Spreminjati je mogoče samo načrtovan trening (US-06, AC 1).
    if (trening.status !== 'NACRTOVAN') {
      throw konflikt(trening.status === 'IZVEDEN' ? 'Izvedenega treninga ni mogoče spreminjati' : 'Odpovedanega treninga ni mogoče spreminjati');
    }
    const podatki = terminShema.parse(req.body);
    const sezona = await preveriTermin(podatki);

    const spremenjen =
      podatki.zacetek.getTime() !== trening.zacetek.getTime() ||
      podatki.konec.getTime() !== trening.konec.getTime() ||
      podatki.lokacija !== trening.lokacija ||
      podatki.vsebina !== trening.vsebina;

    const posodobljen = await prisma.trening.update({
      where: { id: trening.id },
      data: {
        ...podatki,
        sezonaId: sezona.id,
        // Čas spremembe je osnova za oznako »Spremenjeno« v razporedu igralcev (US-06, AC 2).
        ...(spremenjen ? { spremenjenOb: new Date() } : {}),
      },
      include: zEkipo,
    });
    await uskladiPrisotnosti(posodobljen);
    const [izpis] = await izpisTreningov(trenutni(req), [posodobljen]);
    res.json(izpis);
  }),
);

urejanjeTreningovRouter.post(
  '/:id/odpovej',
  asinh(async (req, res) => {
    const trening = await naloziTrening(req, idIzPoti(req));
    await zahtevajVlogo(req, trening.ekipaId, 'TRENER');
    // Treninga z že evidentirano prisotnostjo ni mogoče odpovedati (US-06, AC 5).
    if (trening.status === 'IZVEDEN') throw konflikt('Izvedenega treninga ni mogoče odpovedati');
    if (trening.status === 'ODPOVEDAN') throw konflikt('Trening je že odpovedan');

    const odpovedan = await prisma.trening.update({
      where: { id: trening.id },
      data: { status: 'ODPOVEDAN' },
      include: zEkipo,
    });
    const [izpis] = await izpisTreningov(trenutni(req), [odpovedan]);
    res.json(izpis);
  }),
);
