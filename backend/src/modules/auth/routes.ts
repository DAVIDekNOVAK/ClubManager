import { Router } from 'express';
import { z } from 'zod';
import { dodajMinute } from '../../common/datumi.js';
import { HttpNapaka, neprijavljen } from '../../common/errors.js';
import { asinh } from '../../common/http.js';
import { prisma } from '../../common/prisma.js';
import { preveriGeslo } from './gesla.js';
import { profilUporabnika } from './profil.js';
import { IME_PISKOTKA, unicSejo, ustvariSejo } from './seja.js';

export const NAJVEC_POSKUSOV = 5;
export const OKNO_POSKUSOV_MIN = 15;
export const ZAKLEP_MIN = 15;

// Enotno sporočilo ne razkrije, ali je napačen e-poštni naslov ali geslo (US-20, AC 2).
const NAPACNI_PODATKI = 'Napačen e-poštni naslov ali geslo';

const prijavaShema = z.object({
  ePosta: z.string({ required_error: 'Vnesite e-poštni naslov' }).trim().toLowerCase().min(1, 'Vnesite e-poštni naslov'),
  geslo: z.string({ required_error: 'Vnesite geslo' }).min(1, 'Vnesite geslo'),
});

export const authRouter = Router();

authRouter.post(
  '/prijava',
  asinh(async (req, res) => {
    const { ePosta, geslo } = prijavaShema.parse(req.body);
    const zdaj = new Date();

    const uporabnik = await prisma.uporabnik.findUnique({ where: { ePosta } });
    if (!uporabnik) throw new HttpNapaka(401, NAPACNI_PODATKI);

    if (uporabnik.zaklenjenDo && uporabnik.zaklenjenDo > zdaj) {
      const minut = Math.ceil((uporabnik.zaklenjenDo.getTime() - zdaj.getTime()) / 60_000);
      throw new HttpNapaka(
        429,
        `Prijava je zaradi preveč neuspešnih poskusov začasno onemogočena. Poskusite znova čez ${minut} min.`,
      );
    }

    if (!(await preveriGeslo(uporabnik.gesloHash, geslo))) {
      // Štejemo zaporedne neuspešne poskuse znotraj 15-minutnega okna (US-20, AC 3).
      const oknoVelja =
        uporabnik.prviNeuspesenPoskus !== null &&
        dodajMinute(uporabnik.prviNeuspesenPoskus, OKNO_POSKUSOV_MIN) > zdaj;
      const poskusi = oknoVelja ? uporabnik.neuspesniPoskusi + 1 : 1;
      const zaklep = poskusi >= NAJVEC_POSKUSOV;
      await prisma.uporabnik.update({
        where: { id: uporabnik.id },
        data: zaklep
          ? { neuspesniPoskusi: 0, prviNeuspesenPoskus: null, zaklenjenDo: dodajMinute(zdaj, ZAKLEP_MIN) }
          : { neuspesniPoskusi: poskusi, prviNeuspesenPoskus: oknoVelja ? uporabnik.prviNeuspesenPoskus : zdaj },
      });
      throw new HttpNapaka(401, NAPACNI_PODATKI);
    }

    await prisma.uporabnik.update({
      where: { id: uporabnik.id },
      data: { neuspesniPoskusi: 0, prviNeuspesenPoskus: null, zaklenjenDo: null },
    });
    await ustvariSejo(req, uporabnik.id);
    res.json(await profilUporabnika(uporabnik.id));
  }),
);

authRouter.post(
  '/odjava',
  asinh(async (req, res) => {
    // Seja se uniči na strežniku, zato piškotek po odjavi ni več uporaben (US-20, AC 4).
    await unicSejo(req);
    res.clearCookie(IME_PISKOTKA);
    res.status(204).end();
  }),
);

authRouter.get(
  '/jaz',
  asinh(async (req, res) => {
    const id = req.session.uporabnikId;
    const profil = id ? await profilUporabnika(id) : null;
    if (!profil) throw neprijavljen();
    res.set('Cache-Control', 'no-store');
    res.json(profil);
  }),
);
