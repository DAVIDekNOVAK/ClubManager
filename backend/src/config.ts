import { z } from 'zod';

const shema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL ni nastavljen'),
  SESSION_SECRET: z.string().min(16, 'SESSION_SECRET mora imeti vsaj 16 znakov'),
  FRONTEND_URL: z.string().url().default('http://localhost:5173'),
  SMTP_HOST: z.string().default('localhost'),
  SMTP_PORT: z.coerce.number().int().positive().default(1025),
  MAIL_FROM: z.string().default('ClubManager <no-reply@clubmanager.local>'),
});

const rezultat = shema.safeParse(process.env);

if (!rezultat.success) {
  const napake = rezultat.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
  throw new Error(`Neveljavne nastavitve okolja (preveri datoteko .env):\n${napake}`);
}

export const config = rezultat.data;
export const jeProdukcija = config.NODE_ENV === 'production';
export const jeTest = config.NODE_ENV === 'test';
