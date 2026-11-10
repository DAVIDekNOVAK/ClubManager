import { Router } from 'express';
import { niNajdeno, prepovedano } from '../../common/errors.js';
import { asinh, idIzPoti } from '../../common/http.js';
import { trenutni, zahtevajAdministratorja } from '../../common/pravice.js';
import { prisma } from '../../common/prisma.js';
import { poPriimku } from '../../common/razvrsti.js';
import { profilUporabnika } from '../auth/profil.js';

export const uporabnikiRouter = Router();

// Seznam uporabnikov za izbiro pri dodajanju v ekipo (samo administrator).
uporabnikiRouter.get(
  '/',
  zahtevajAdministratorja,
  asinh(async (_req, res) => {
    const uporabniki = await prisma.uporabnik.findMany({
      select: { id: true, ime: true, priimek: true, ePosta: true, jeAdministrator: true },
    });
    res.json(uporabniki.sort(poPriimku));
  }),
);

// Profil z vsemi članstvi: uporabnik vidi svojega, administrator vse (US-03, AC 3).
uporabnikiRouter.get(
  '/:id',
  asinh(async (req, res) => {
    const id = idIzPoti(req);
    const jaz = trenutni(req);
    if (jaz.id !== id && !jaz.jeAdministrator) throw prepovedano();
    const profil = await profilUporabnika(id);
    if (!profil) throw niNajdeno('Uporabnik');
    res.json(profil);
  }),
);
