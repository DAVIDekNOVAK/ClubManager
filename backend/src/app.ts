import express from 'express';
import { neznanaPot, obravnavaNapak } from './common/errors.js';
import { authRouter } from './modules/auth/routes.js';
import { csrfZascita, sejeMiddleware } from './modules/auth/seja.js';
import { healthRouter } from './modules/health/routes.js';

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

  app.use('/api', api);
  app.use(neznanaPot);
  app.use(obravnavaNapak);
  return app;
}
