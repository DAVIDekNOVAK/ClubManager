import express from 'express';
import { neznanaPot, obravnavaNapak } from './common/errors.js';
import { healthRouter } from './modules/health/routes.js';

/** Sestavi aplikacijo Express. Ločeno od zagona strežnika, da jo lahko uporabijo testi. */
export function ustvariAplikacijo() {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '1mb' }));

  const api = express.Router();
  api.use('/health', healthRouter);

  app.use('/api', api);
  app.use(neznanaPot);
  app.use(obravnavaNapak);
  return app;
}
