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

// ---------------------------------------------------------------------------
// Testni klub: sezona, ekipa in člani z vlogami
// ---------------------------------------------------------------------------
import type { Vloga } from '@prisma/client';
import { dan, dodajDni } from '../src/common/datumi.js';

export const E_ADMIN = 'admin@example.com';
export const E_TRENER = 'trener@example.com';
export const E_VODJA = 'vodja@example.com';
export const E_IGRALEC = 'igralec1@example.com';
export const E_DRUG = 'drug@example.com';

export async function dodajClana(uporabnikId: number, ekipaId: number, sezonaId: number, vloge: Vloga[], od?: Date) {
  return prisma.clanstvoVEkipi.create({
    data: {
      uporabnikId,
      ekipaId,
      sezonaId,
      datumPridruzitve: od ?? dodajDni(dan(), -100),
      vloge: { create: vloge.map((vloga) => ({ vloga })) },
    },
  });
}

/**
 * Ustvari testni klub: aktivno sezono, ekipo »Člani« z administratorjem, trenerjem,
 * vodjo ekipe in `steviloIgralcev` igralci ter drugo ekipo »U17« z uporabnikom `E_DRUG` (trener U17).
 */
export async function ustvariKlub(steviloIgralcev = 3) {
  const danes = dan();
  const sezona = await prisma.sezona.create({
    data: { naziv: 'Aktivna', datumZacetka: dodajDni(danes, -120), datumKonca: dodajDni(danes, 240) },
  });
  const ekipa = await prisma.ekipa.create({ data: { naziv: 'Člani', kategorija: 'CLANI' } });
  const drugaEkipa = await prisma.ekipa.create({ data: { naziv: 'U17', kategorija: 'U17' } });

  const admin = await ustvariUporabnika({ ePosta: E_ADMIN, ime: 'Ada', priimek: 'Admin', jeAdministrator: true });
  const trener = await ustvariUporabnika({ ePosta: E_TRENER, ime: 'Tine', priimek: 'Trener' });
  const vodja = await ustvariUporabnika({ ePosta: E_VODJA, ime: 'Vida', priimek: 'Vodja' });
  const drug = await ustvariUporabnika({ ePosta: E_DRUG, ime: 'Drago', priimek: 'Drug' });
  await dodajClana(trener.id, ekipa.id, sezona.id, ['TRENER']);
  await dodajClana(vodja.id, ekipa.id, sezona.id, ['VODJA_EKIPE']);
  await dodajClana(drug.id, drugaEkipa.id, sezona.id, ['TRENER']);

  const igralci = [];
  for (let i = 1; i <= steviloIgralcev; i++) {
    const igralec = await ustvariUporabnika({ ePosta: `igralec${i}@example.com`, ime: `Igralec${i}`, priimek: `Priimek${String(i).padStart(2, '0')}` });
    await dodajClana(igralec.id, ekipa.id, sezona.id, ['IGRALEC']);
    igralci.push(igralec);
  }
  return { sezona, ekipa, drugaEkipa, admin, trener, vodja, drug, igralci };
}
