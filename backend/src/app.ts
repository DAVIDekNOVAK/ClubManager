import express from 'express';
import { neznanaPot, obravnavaNapak } from './common/errors.js';
import { zahtevajPrijavo } from './common/pravice.js';
import { authRouter } from './modules/auth/routes.js';
import { csrfZascita, sejeMiddleware } from './modules/auth/seja.js';
import { clanstvaEkipe, clanstvaRouter } from './modules/clanstva/routes.js';
import { ekipeRouter } from './modules/ekipe/routes.js';
import { healthRouter } from './modules/health/routes.js';
import { javnaPovabilaRouter } from './modules/povabila/javno.js';
import { klubiRouter } from './modules/klubi/routes.js';
import { povabilaRouter } from './modules/povabila/routes.js';
import { razpolozljivostEkipeRoute, razpolozljivostRouter } from './modules/razpolozljivost/routes.js';
import { sezoneRouter } from './modules/sezone/routes.js';
import { porociloRouter } from './modules/tekme/porocilo.js';
import { razpolozljivostTekmeRouter } from './modules/tekme/razpolozljivost.js';
import { tekmeRouter } from './modules/tekme/routes.js';
import { prisotnostRouter } from './modules/treningi/prisotnost.js';
import { treningiRouter } from './modules/treningi/routes.js';
import { udelezbaRouter } from './modules/treningi/udelezba.js';
import { urejanjeTreningovRouter } from './modules/treningi/urejanje.js';
import { uporabnikiRouter } from './modules/uporabniki/routes.js';

/** Sestavi aplikacijo Express. Ločeno od zagona strežnika, da jo lahko uporabijo testi. */
export function ustvariAplikacijo() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '1mb' }));

  const api = express.Router();
  api.use('/health', healthRouter);
  api.use(sejeMiddleware());
  api.use(csrfZascita);
  // Odgovori API-ja vsebujejo osebne podatke, zato jih brskalnik ne sme hraniti v predpomnilniku
  // (po odjavi gumb »Nazaj« ne sme prikazati starih podatkov).
  api.use((_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });
  api.use('/auth', authRouter);
  api.use('/povabila/zeton', javnaPovabilaRouter);

  // Vse poti od tu naprej zahtevajo prijavo.
  api.use(zahtevajPrijavo);
  api.use('/sezone', sezoneRouter);
  api.get('/ekipe/:id/clanstva', clanstvaEkipe);
  api.get('/ekipe/:id/razpolozljivost', razpolozljivostEkipeRoute);
  api.use('/ekipe', ekipeRouter);
  api.use('/clanstva', clanstvaRouter);
  api.use('/uporabniki', uporabnikiRouter);
  api.use('/povabila', povabilaRouter);
  api.use('/nasprotni-klubi', klubiRouter);
  api.use('/razpolozljivost', razpolozljivostRouter);
  api.use('/tekme', tekmeRouter);
  api.use('/tekme', razpolozljivostTekmeRouter);
  api.use('/tekme', porociloRouter);
  api.use('/treningi', treningiRouter);
  api.use('/treningi', urejanjeTreningovRouter);
  api.use('/treningi', udelezbaRouter);
  api.use('/treningi', prisotnostRouter);

  app.use('/api', api);
  app.use(neznanaPot);
  app.use(obravnavaNapak);
  return app;
}
