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

/** Ustvari odigrano tekmo (termin pred `urNazaj` urami) testnega kluba. */
export async function ustvariTekmo(klub: { ekipa: { id: number }; sezona: { id: number } }, urNazaj = 3, prepis: Record<string, unknown> = {}) {
  const nasprotnik =
    (await prisma.nasprotniKlub.findFirst()) ?? (await prisma.nasprotniKlub.create({ data: { naziv: 'NK Triglav', kraj: 'Kranj' } }));
  return prisma.tekma.create({
    data: {
      ekipaId: klub.ekipa.id,
      sezonaId: klub.sezona.id,
      nasprotniKlubId: nasprotnik.id,
      datumInUra: new Date(Date.now() - urNazaj * 3_600_000),
      jeDomaca: true,
      lokacija: 'Mestni stadion',
      vrstaTekmovanja: 'PRVENSTVO',
      ...prepis,
    },
  });
}

/**
 * Zaključena tekma testnega kluba: prvih 11 igralcev v začetni postavi (90 minut), 12. igralec
 * na klopi brez minut. `goli` so pari [strelec, asistent?], `kartoni` pari [igralec, vrsta] (indeksi igralcev).
 */
export async function zakljucenaTekma(
  klub: { ekipa: { id: number }; sezona: { id: number }; igralci: { id: number }[] },
  moznosti: { goli?: [number, number?][]; goliNasprotnika?: number; kartoni?: [number, 'RUMENI_KARTON' | 'RDECI_KARTON'][]; status?: 'ZAKLJUCENA' | 'ODIGRANA'; urNazaj?: number; sezonaId?: number; ekipaId?: number } = {},
) {
  const goli = moznosti.goli ?? [];
  const tekma = await ustvariTekmo(
    { ekipa: { id: moznosti.ekipaId ?? klub.ekipa.id }, sezona: { id: moznosti.sezonaId ?? klub.sezona.id } },
    moznosti.urNazaj ?? 24,
    { status: moznosti.status ?? 'ZAKLJUCENA', domaciGoli: goli.length, gostujociGoli: moznosti.goliNasprotnika ?? 0 },
  );
  await prisma.nastopNaTekmi.createMany({
    data: klub.igralci.slice(0, 12).map((i, n) => ({ tekmaId: tekma.id, igralecId: i.id, zacetnaPostava: n < 11, odigraneMinute: n < 11 ? 90 : 0 })),
  });
  for (const [n, [strelec, asistent]] of goli.entries()) {
    const gol = await prisma.dogodekNaTekmi.create({ data: { tekmaId: tekma.id, vrstaDogodka: 'GOL', igralecId: klub.igralci[strelec].id, minuta: 10 + n } });
    if (asistent !== undefined) {
      await prisma.dogodekNaTekmi.create({ data: { tekmaId: tekma.id, vrstaDogodka: 'ASISTENCA', igralecId: klub.igralci[asistent].id, minuta: 10 + n, golId: gol.id } });
    }
  }
  for (const [igralec, vrsta] of moznosti.kartoni ?? []) {
    await prisma.dogodekNaTekmi.create({ data: { tekmaId: tekma.id, vrstaDogodka: vrsta, igralecId: klub.igralci[igralec].id, minuta: 60 } });
  }
  return tekma;
}

/** Trening testnega kluba pred `dniNazaj` dnevi z dano dejansko prisotnostjo po igralcih (indeks → vrednost). */
export async function izvedenTrening(
  klub: { ekipa: { id: number }; sezona: { id: number }; igralci: { id: number }[] },
  dniNazaj: number,
  odsotni: number[] = [],
  status: 'IZVEDEN' | 'ODPOVEDAN' | 'NACRTOVAN' = 'IZVEDEN',
) {
  const zacetek = new Date(Date.now() - dniNazaj * 86_400_000);
  const trening = await prisma.trening.create({
    data: { ekipaId: klub.ekipa.id, sezonaId: klub.sezona.id, zacetek, konec: new Date(zacetek.getTime() + 5_400_000), lokacija: 'Igrišče', status },
  });
  await prisma.prisotnost.createMany({
    data: klub.igralci.map((i, n) => ({
      treningId: trening.id,
      igralecId: i.id,
      dejanskaPrisotnost: status === 'IZVEDEN' ? (odsotni.includes(n) ? ('NEOPRAVICENO_ODSOTEN' as const) : ('PRISOTEN' as const)) : null,
    })),
  });
  return trening;
}
