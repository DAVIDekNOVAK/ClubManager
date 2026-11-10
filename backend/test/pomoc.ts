import { prisma } from '../src/common/prisma.js';

/** Izprazni vse tabele testne baze in ponastavi števce id. */
export async function pocistiBazo() {
  const tabele = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  if (tabele.length === 0) return;
  const seznam = tabele.map((t) => `"public"."${t.tablename}"`).join(', ');
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${seznam} RESTART IDENTITY CASCADE`);
}

// ---------------------------------------------------------------------------
// Pomožne funkcije za teste API-ja
// ---------------------------------------------------------------------------
import type { Express } from 'express';
import request from 'supertest';
import { zgostiGeslo } from '../src/modules/auth/gesla.js';

export const GESLO = 'Geslo1234';
let gesloHash: string | undefined;

/** Ustvari uporabnika z geslom `GESLO`. */
export async function ustvariUporabnika(podatki: { ePosta: string; ime?: string; priimek?: string; jeAdministrator?: boolean }) {
  gesloHash ??= await zgostiGeslo(GESLO);
  return prisma.uporabnik.create({
    data: {
      ime: podatki.ime ?? 'Test',
      priimek: podatki.priimek ?? 'Uporabnik',
      ePosta: podatki.ePosta,
      jeAdministrator: podatki.jeAdministrator ?? false,
      gesloHash,
    },
  });
}

/** Odjemalec, ki hrani piškotke in pošilja glavo za zaščito pred CSRF. */
export function odjemalec(app: Express) {
  const agent = request.agent(app);
  agent.set('X-Requested-With', 'ClubManager');
  return agent;
}

/** Odjemalec, prijavljen kot uporabnik z danim e-poštnim naslovom. */
export async function prijavljen(app: Express, ePosta: string) {
  const agent = odjemalec(app);
  const odgovor = await agent.post('/api/auth/prijava').send({ ePosta, geslo: GESLO });
  if (odgovor.status !== 200) throw new Error(`Prijava ni uspela: ${odgovor.status} ${JSON.stringify(odgovor.body)}`);
  return agent;
}
