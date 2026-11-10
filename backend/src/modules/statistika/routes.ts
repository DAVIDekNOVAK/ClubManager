import { Router } from 'express';
import { z } from 'zod';
import { niNajdeno, prepovedano } from '../../common/errors.js';
import { asinh, idIzPoti, zId } from '../../common/http.js';
import { ekipeZVlogo, trenutni } from '../../common/pravice.js';
import { prisma } from '../../common/prisma.js';
import { poNazivu } from '../../common/razvrsti.js';
import { statusSezone } from '../sezone/routes.js';
import { imaPodatke, izracunajStatistiko } from './izracun.js';

const filterShema = z.object({ sezonaId: zId.optional(), ekipaId: zId.optional() });

export const statistikaRouter = Router();

// Osebna statistika igralca po sezonah in ekipah (US-14).
statistikaRouter.get(
  '/igralec/:id',
  asinh(async (req, res) => {
    const uporabnik = trenutni(req);
    const igralecId = idIzPoti(req);
    const filter = filterShema.parse(req.query);

    const igralec = await prisma.uporabnik.findUnique({ where: { id: igralecId }, select: { id: true, ime: true, priimek: true } });
    if (!igralec) throw niNajdeno('Igralec');

    // Vključena so tudi članstva v preteklih sezonah in ekipah, iz katerih je igralec že odšel (AC 2).
    const clanstva = await prisma.clanstvoVEkipi.findMany({
      where: { uporabnikId: igralecId, vloge: { some: { vloga: 'IGRALEC' } } },
      select: { ekipa: { select: { id: true, naziv: true } }, sezona: true },
    });

    // Statistiko vidi igralec sam, administrator in trener ekipe, v kateri igralec igra.
    if (uporabnik.id !== igralecId && !uporabnik.jeAdministrator) {
      const trenerVEkipah = await ekipeZVlogo(uporabnik.id, 'TRENER');
      if (!clanstva.some((c) => trenerVEkipah.includes(c.ekipa.id))) throw prepovedano();
    }

    const sezone = [...new Map(clanstva.map((c) => [c.sezona.id, c.sezona])).values()].sort(
      (a, b) => b.datumZacetka.getTime() - a.datumZacetka.getTime(),
    );
    const ekipe = [...new Map(clanstva.map((c) => [c.ekipa.id, c.ekipa])).values()].sort(poNazivu);

    // Privzeto je izbrana trenutna sezona (AC 2).
    const trenutna = (await prisma.sezona.findMany()).find((s) => statusSezone(s) === 'AKTIVNA');
    const sezonaId = filter.sezonaId ?? trenutna?.id ?? sezone[0]?.id ?? null;

    const zaSezono = async (id: number) => (await izracunajStatistiko({ sezonaId: id, ekipaId: filter.ekipaId, igralecIds: [igralecId] })).get(igralecId)!;
    const statistika = sezonaId ? await zaSezono(sezonaId) : null;
    const poSezonah = await Promise.all(
      sezone.map(async (s) => ({ sezona: { id: s.id, naziv: s.naziv }, statistika: await zaSezono(s.id) })),
    );

    res.json({
      igralec,
      sezone: sezone.map((s) => ({ id: s.id, naziv: s.naziv, status: statusSezone(s) })),
      ekipe,
      sezonaId,
      ekipaId: filter.ekipaId ?? null,
      statistika,
      // Brez nastopov in treningov vmesnik prikaže »Za izbrano sezono ni podatkov« (AC 5).
      imaPodatke: statistika ? imaPodatke(statistika) : false,
      poSezonah,
    });
  }),
);
