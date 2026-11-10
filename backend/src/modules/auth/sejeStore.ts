import session from 'express-session';
import { prisma } from '../../common/prisma.js';

const PRIVZETO_TRAJANJE_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Shramba sej v tabeli `Seja` (ADR-0005). Ker so seje v bazi, jih je mogoče
 * kadarkoli preklicati na strežniku in preživijo ponovni zagon aplikacije.
 */
export class PrismaSejeStore extends session.Store {
  private potek(sess: session.SessionData): Date {
    const expires = sess.cookie?.expires;
    return expires ? new Date(expires) : new Date(Date.now() + PRIVZETO_TRAJANJE_MS);
  }

  get(sid: string, cb: (err: unknown, sess?: session.SessionData | null) => void) {
    prisma.seja
      .findUnique({ where: { id: sid } })
      .then(async (seja) => {
        if (!seja) return cb(null, null);
        if (seja.datumPoteka < new Date()) {
          await prisma.seja.deleteMany({ where: { id: sid } });
          return cb(null, null);
        }
        cb(null, seja.podatkiSeje as unknown as session.SessionData);
      })
      .catch((e) => cb(e));
  }

  set(sid: string, sess: session.SessionData, cb?: (err?: unknown) => void) {
    const podatki = {
      uporabnikId: sess.uporabnikId ?? null,
      podatkiSeje: JSON.parse(JSON.stringify(sess)),
      datumPoteka: this.potek(sess),
    };
    prisma.seja
      .upsert({ where: { id: sid }, create: { id: sid, ...podatki }, update: podatki })
      .then(() => cb?.())
      .catch((e) => cb?.(e));
  }

  touch(sid: string, sess: session.SessionData, cb?: (err?: unknown) => void) {
    prisma.seja
      .updateMany({ where: { id: sid }, data: { datumPoteka: this.potek(sess) } })
      .then(() => cb?.())
      .catch((e) => cb?.(e));
  }

  destroy(sid: string, cb?: (err?: unknown) => void) {
    prisma.seja
      .deleteMany({ where: { id: sid } })
      .then(() => cb?.())
      .catch((e) => cb?.(e));
  }
}
