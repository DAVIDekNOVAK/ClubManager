import { Router } from 'express';
import { z } from 'zod';
import { dan } from '../../common/datumi.js';
import { HttpNapaka } from '../../common/errors.js';
import { asinh, zBesedilo } from '../../common/http.js';
import { prisma } from '../../common/prisma.js';
import { zgostiGeslo } from '../auth/gesla.js';
import { profilUporabnika } from '../auth/profil.js';
import { ustvariSejo } from '../auth/seja.js';
import { zgostiZeton } from './zeton.js';

const NEVELJAVNO = 'Povabilo ni več veljavno – obrnite se na administratorja kluba';

/** Pravila za geslo (US-19, AC 2): vsaj 8 znakov, vsaj ena črka in ena številka. */
export const zGeslo = z
  .string({ required_error: 'Vnesite geslo' })
  .min(8, 'Geslo mora imeti vsaj 8 znakov')
  .max(200, 'Geslo je predolgo')
  .regex(/\p{L}/u, 'Geslo mora vsebovati vsaj eno črko')
  .regex(/\d/, 'Geslo mora vsebovati vsaj eno številko');

const registracijaShema = z
  .object({
    ime: zBesedilo(1, 50),
    priimek: zBesedilo(1, 50),
    geslo: zGeslo,
    gesloPonovno: z.string({ required_error: 'Ponovite geslo' }),
  })
  .refine((p) => p.geslo === p.gesloPonovno, { path: ['gesloPonovno'], message: 'Gesli se ne ujemata' });

/** Poišče povabilo po žetonu; uporabljeno ali poteklo povabilo ni veljavno (US-19, AC 4). */
async function veljavnoPovabilo(zeton: string) {
  const povabilo = await prisma.povabilo.findUnique({
    where: { zgoscenaVrednostZetona: zgostiZeton(zeton) },
    include: { ekipa: { select: { naziv: true } }, sezona: { select: { naziv: true, datumZacetka: true } } },
  });
  if (!povabilo || povabilo.datumSprejetja || povabilo.datumPoteka < new Date()) {
    throw new HttpNapaka(410, NEVELJAVNO);
  }
  return povabilo;
}

/** Poti za povabljenega uporabnika – dostopne brez prijave, zaščitene z žetonom. */
export const javnaPovabilaRouter = Router();

javnaPovabilaRouter.get(
  '/:zeton',
  asinh(async (req, res) => {
    const povabilo = await veljavnoPovabilo(req.params.zeton);
    res.json({
      ePosta: povabilo.ePosta,
      vloga: povabilo.vloga,
      ekipa: povabilo.ekipa.naziv,
      sezona: povabilo.sezona.naziv,
    });
  }),
);

javnaPovabilaRouter.post(
  '/:zeton/sprejmi',
  asinh(async (req, res) => {
    const povabilo = await veljavnoPovabilo(req.params.zeton);
    const podatki = registracijaShema.parse(req.body);
    if (await prisma.uporabnik.findUnique({ where: { ePosta: povabilo.ePosta } })) {
      throw new HttpNapaka(410, NEVELJAVNO);
    }
    const gesloHash = await zgostiGeslo(podatki.geslo);
    const danes = dan();

    // Račun, članstvo z vlogo iz povabila in oznaka sprejetja nastanejo skupaj ali sploh ne.
    const uporabnik = await prisma.$transaction(async (tx) => {
      // Pogoj `datumSprejetja: null` prepreči, da bi isto povabilo sprejeli dvakrat hkrati.
      const oznaceno = await tx.povabilo.updateMany({
        where: { id: povabilo.id, datumSprejetja: null },
        data: { datumSprejetja: new Date() },
      });
      if (oznaceno.count !== 1) throw new HttpNapaka(410, NEVELJAVNO);
      return tx.uporabnik.create({
        data: {
          ime: podatki.ime,
          priimek: podatki.priimek,
          ePosta: povabilo.ePosta,
          gesloHash,
          clanstva: {
            create: {
              ekipaId: povabilo.ekipaId,
              sezonaId: povabilo.sezonaId,
              // Če se sezona še ni začela, članstvo velja od njenega začetka.
              datumPridruzitve: povabilo.sezona.datumZacetka > danes ? povabilo.sezona.datumZacetka : danes,
              vloge: { create: { vloga: povabilo.vloga } },
            },
          },
        },
      });
    });

    await ustvariSejo(req, uporabnik.id);
    res.status(201).json(await profilUporabnika(uporabnik.id));
  }),
);
