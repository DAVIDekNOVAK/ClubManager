import { beforeEach, describe, expect, it } from 'vitest';
import { dan, dodajDni } from '../src/common/datumi.js';
import { ekipeZVlogo, imaVlogo, veljavniIgralci, vlogeVEkipi } from '../src/common/pravice.js';
import { prisma } from '../src/common/prisma.js';
import { pocistiBazo, ustvariKlub } from './pomoc.js';

describe('preverjanje pravic (RBAC + članstvo)', () => {
  beforeEach(pocistiBazo);

  it('vloge so vezane na ekipo', async () => {
    const { ekipa, drugaEkipa, trener, igralci } = await ustvariKlub(1);
    expect([...(await vlogeVEkipi(trener.id, ekipa.id))]).toEqual(['TRENER']);
    expect(await imaVlogo(trener.id, drugaEkipa.id, 'TRENER')).toBe(false);
    expect(await imaVlogo(igralci[0].id, ekipa.id, 'TRENER', 'VODJA_EKIPE')).toBe(false);
    expect(await ekipeZVlogo(trener.id, 'TRENER')).toEqual([ekipa.id]);
  });

  it('po datumu odhoda uporabnik nima več vloge v ekipi', async () => {
    const { ekipa, trener } = await ustvariKlub(0);
    await prisma.clanstvoVEkipi.updateMany({
      where: { uporabnikId: trener.id },
      data: { datumOdhoda: dodajDni(dan(), -1) },
    });
    expect(await imaVlogo(trener.id, ekipa.id, 'TRENER')).toBe(false);
  });

  it('veljavni igralci so samo igralci s članstvom na izbrani dan', async () => {
    const { ekipa, sezona, igralci } = await ustvariKlub(3);
    const danes = dan();
    // Igralec 1 je odšel pred 10 dnevi, igralec 2 se pridruži šele čez 10 dni.
    await prisma.clanstvoVEkipi.updateMany({ where: { uporabnikId: igralci[0].id }, data: { datumOdhoda: dodajDni(danes, -10) } });
    await prisma.clanstvoVEkipi.updateMany({ where: { uporabnikId: igralci[1].id }, data: { datumPridruzitve: dodajDni(danes, 10) } });

    const danesVeljavni = await veljavniIgralci(ekipa.id, sezona.id, danes);
    expect(danesVeljavni.map((i) => i.id)).toEqual([igralci[2].id]);

    const predDvajsetimiDnevi = await veljavniIgralci(ekipa.id, sezona.id, dodajDni(danes, -20));
    expect(predDvajsetimiDnevi.map((i) => i.id)).toEqual([igralci[0].id, igralci[2].id]);
  });
});
