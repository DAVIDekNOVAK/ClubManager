import { VrstaTekmovanja } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';
import { niNajdeno, prepovedano } from '../../common/errors.js';
import { asinh, idIzPoti, zId } from '../../common/http.js';
import { ekipeZVlogo, trenutni, zahtevajVlogoAliAdmina } from '../../common/pravice.js';
import { prisma } from '../../common/prisma.js';
import { poNazivu, poPriimku } from '../../common/razvrsti.js';
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

const filterEkipeShema = z.object({
  sezonaId: zId.optional(),
  vrstaTekmovanja: z.nativeEnum(VrstaTekmovanja).optional(),
});

// Statistika ekipe in vseh njenih igralcev v sezoni (US-15).
statistikaRouter.get(
  '/ekipa/:id',
  asinh(async (req, res) => {
    const ekipaId = idIzPoti(req);
    const filter = filterEkipeShema.parse(req.query);
    const ekipa = await prisma.ekipa.findUnique({ where: { id: ekipaId }, select: { id: true, naziv: true, jeArhivirana: true } });
    if (!ekipa) throw niNajdeno('Ekipa');
    // Trener vidi statistiko samo svojih ekip, administrator vseh (AC 4).
    await zahtevajVlogoAliAdmina(req, ekipaId, 'TRENER');

    const sezone = await prisma.sezona.findMany({ orderBy: { datumZacetka: 'desc' } });
    const sezonaId = filter.sezonaId ?? sezone.find((s) => statusSezone(s) === 'AKTIVNA')?.id ?? sezone[0]?.id;
    if (!sezonaId) throw niNajdeno('Sezona');

    // Povzetek ekipe: samo zaključene tekme (AC 1).
    const tekme = await prisma.tekma.findMany({
      where: { ekipaId, sezonaId, status: 'ZAKLJUCENA', ...(filter.vrstaTekmovanja ? { vrstaTekmovanja: filter.vrstaTekmovanja } : {}) },
      include: { nasprotniKlub: { select: { naziv: true } } },
      orderBy: { datumInUra: 'desc' },
    });
    const povzetek = { tekme: tekme.length, zmage: 0, remiji: 0, porazi: 0, daniGoli: 0, prejetiGoli: 0, povprecnaPrisotnost: null as number | null };
    const izidi = tekme.map((t) => {
      const nasi = (t.jeDomaca ? t.domaciGoli : t.gostujociGoli) ?? 0;
      const njihovi = (t.jeDomaca ? t.gostujociGoli : t.domaciGoli) ?? 0;
      povzetek.daniGoli += nasi;
      povzetek.prejetiGoli += njihovi;
      const izid = nasi > njihovi ? ('Z' as const) : nasi < njihovi ? ('P' as const) : ('R' as const);
      if (izid === 'Z') povzetek.zmage += 1;
      else if (izid === 'P') povzetek.porazi += 1;
      else povzetek.remiji += 1;
      return { id: t.id, datumInUra: t.datumInUra, nasprotnik: t.nasprotniKlub.naziv, nasiGoli: nasi, goliNasprotnika: njihovi, izid };
    });

    // V tabeli so vsi igralci, ki so bili v izbrani sezoni člani ekipe (tudi tisti, ki so že odšli).
    const clanstva = await prisma.clanstvoVEkipi.findMany({
      where: { ekipaId, sezonaId, vloge: { some: { vloga: 'IGRALEC' } } },
      select: { uporabnik: { select: { id: true, ime: true, priimek: true } } },
    });
    const igralci = clanstva.map((c) => c.uporabnik).sort(poPriimku);
    const statistike = await izracunajStatistiko({ sezonaId, ekipaId, igralecIds: igralci.map((i) => i.id), vrstaTekmovanja: filter.vrstaTekmovanja });

    let izvedeni = 0;
    let prisoten = 0;
    const vrstice = igralci.map((i) => {
      const s = statistike.get(i.id)!;
      izvedeni += s.treningiIzvedeni;
      prisoten += s.treningiPrisoten;
      return { igralecId: i.id, ime: i.ime, priimek: i.priimek, ...s };
    });
    povzetek.povprecnaPrisotnost = izvedeni > 0 ? Math.round((prisoten / izvedeni) * 100) : null;
    const strelec = [...vrstice].sort((a, b) => b.goli - a.goli)[0];

    res.json({
      ekipa,
      sezonaId,
      sezone: sezone.map((s) => ({ id: s.id, naziv: s.naziv, status: statusSezone(s) })),
      vrstaTekmovanja: filter.vrstaTekmovanja ?? null,
      povzetek,
      zadnjeTekme: izidi.slice(0, 5),
      najboljsiStrelec: strelec && strelec.goli > 0 ? { ime: strelec.ime, priimek: strelec.priimek, goli: strelec.goli } : null,
      igralci: vrstice,
    });
  }),
);
