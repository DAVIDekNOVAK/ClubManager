import { StatusRazpolozljivosti } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';
import { dan, dodajDni } from '../../common/datumi.js';
import { napakaPolja, niNajdeno, prepovedano } from '../../common/errors.js';
import { asinh, idIzPoti, zDatum } from '../../common/http.js';
import { ekipeZVlogo, sezonaZaDan, trenutni, zahtevajVlogoAliAdmina } from '../../common/pravice.js';
import { prisma } from '../../common/prisma.js';
import { razpolozljivostEkipe, statusiNaDan } from './skupno.js';

const novStatusShema = z.object({
  status: z.nativeEnum(StatusRazpolozljivosti, { errorMap: () => ({ message: 'Izberite status' }) }),
  veljaOd: zDatum.optional(),
  veljaDo: zDatum.nullish(),
});

async function pregled(igralecId: number) {
  const danes = dan();
  const [statusi, zgodovina] = await Promise.all([
    statusiNaDan([igralecId], danes),
    prisma.razpolozljivostIgralca.findMany({
      where: { igralecId },
      orderBy: [{ veljaOd: 'desc' }, { id: 'desc' }],
      select: { id: true, status: true, veljaOd: true, veljaDo: true, ustvarjena: true },
    }),
  ]);
  return { trenutni: statusi.get(igralecId)!, zgodovina };
}

export const razpolozljivostRouter = Router();

// Trenutni status in zgodovina razpoložljivosti prijavljenega igralca.
razpolozljivostRouter.get(
  '/moja',
  asinh(async (req, res) => {
    res.json(await pregled(trenutni(req).id));
  }),
);

razpolozljivostRouter.post(
  '/',
  asinh(async (req, res) => {
    const uporabnik = trenutni(req);
    // Razpoložljivost posodablja igralec zase.
    if ((await ekipeZVlogo(uporabnik.id, 'IGRALEC')).length === 0) throw prepovedano('Razpoložljivost lahko posodabljajo samo igralci');
    const podatki = novStatusShema.parse(req.body);
    const danes = dan();
    const veljaOd = podatki.veljaOd ?? danes;
    const veljaDo = podatki.veljaDo ?? null;
    if (veljaOd < danes) throw napakaPolja('veljaOd', 'Datum začetka ne sme biti v preteklosti');
    if (veljaDo && veljaDo < veljaOd) throw napakaPolja('veljaDo', 'Datum konca ne sme biti pred datumom začetka');

    await prisma.$transaction(async (tx) => {
      // Prejšnjemu statusu se samodejno nastavi datum konca; zapis ostane v zgodovini (US-16, AC 2).
      await tx.razpolozljivostIgralca.updateMany({
        where: { igralecId: uporabnik.id, veljaOd: { lt: veljaOd }, OR: [{ veljaDo: null }, { veljaDo: { gte: veljaOd } }] },
        data: { veljaDo: dodajDni(veljaOd, -1) },
      });
      await tx.razpolozljivostIgralca.create({ data: { igralecId: uporabnik.id, status: podatki.status, veljaOd, veljaDo } });
    });
    res.status(201).json(await pregled(uporabnik.id));
  }),
);

/** Razpoložljivost igralcev ekipe na izbrani dan (privzeto danes): `GET /api/ekipe/:id/razpolozljivost?datum=`. */
export const razpolozljivostEkipeRoute = asinh(async (req, res) => {
  const ekipaId = idIzPoti(req);
  if (!(await prisma.ekipa.findUnique({ where: { id: ekipaId } }))) throw niNajdeno('Ekipa');
  await zahtevajVlogoAliAdmina(req, ekipaId, 'TRENER');
  const naDan = req.query.datum ? zDatum.parse(req.query.datum) : dan();
  const sezona = await sezonaZaDan(naDan);
  if (!sezona) {
    res.json({ datum: naDan, igralci: [], povzetek: { NA_VOLJO: 0, OMEJENO_TRENIRANJE: 0, POSKODOVAN: 0, ODSOTEN: 0 } });
    return;
  }
  res.json(await razpolozljivostEkipe(ekipaId, sezona.id, naDan));
});
