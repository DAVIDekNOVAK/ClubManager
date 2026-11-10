import express from 'express';
import { neznanaPot, obravnavaNapak } from './common/errors.js';
import { zahtevajPrijavo } from './common/pravice.js';
import { authRouter } from './modules/auth/routes.js';
import { csrfZascita, sejeMiddleware } from './modules/auth/seja.js';
import { ekipeRouter } from './modules/ekipe/routes.js';
import { healthRouter } from './modules/health/routes.js';
import { sezoneRouter } from './modules/sezone/routes.js';

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

  // Vse poti od tu naprej zahtevajo prijavo.
  api.use(zahtevajPrijavo);
  api.use('/sezone', sezoneRouter);
  api.use('/ekipe', ekipeRouter);

  app.use('/api', api);
  app.use(neznanaPot);
  app.use(obravnavaNapak);
  return app;
}
