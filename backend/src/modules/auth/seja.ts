import type { Request, RequestHandler } from 'express';
import session from 'express-session';
import { prepovedano } from '../../common/errors.js';
import { config, jeProdukcija } from '../../config.js';
import { PrismaSejeStore } from './sejeStore.js';

declare module 'express-session' {
  interface SessionData {
    uporabnikId?: number;
  }
}

export const IME_PISKOTKA = 'clubmanager.sid';

/** Strežniške seje s piškotkom HttpOnly, ki ga JavaScript v brskalniku ne more prebrati. */
export function sejeMiddleware(): RequestHandler {
  return session({
    name: IME_PISKOTKA,
    secret: config.SESSION_SECRET,
    store: new PrismaSejeStore(),
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: jeProdukcija,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    },
  });
}

/**
 * Zaščita pred CSRF: zahteve, ki spreminjajo podatke, morajo imeti lastno glavo.
 * Brskalnik tuji strani ne dovoli nastaviti lastne glave brez dovoljenja CORS,
 * piškotek seje pa ima dodatno nastavljen SameSite=Lax.
 */
export const csrfZascita: RequestHandler = (req, _res, next) => {
  const varnaMetoda = ['GET', 'HEAD', 'OPTIONS'].includes(req.method);
  if (!varnaMetoda && req.get('X-Requested-With') !== 'ClubManager') {
    next(prepovedano('Zahteva je bila zavrnjena (manjka glava X-Requested-With)'));
    return;
  }
  next();
};

export const ustvariSejo = (req: Request, uporabnikId: number) =>
  new Promise<void>((resolve, reject) => {
    // Nov identifikator seje ob prijavi prepreči napad s fiksacijo seje.
    req.session.regenerate((err) => {
      if (err) return reject(err);
      req.session.uporabnikId = uporabnikId;
      req.session.save((err2) => (err2 ? reject(err2) : resolve()));
    });
  });

export const unicSejo = (req: Request) =>
  new Promise<void>((resolve, reject) => {
    req.session.destroy((err) => (err ? reject(err) : resolve()));
  });
