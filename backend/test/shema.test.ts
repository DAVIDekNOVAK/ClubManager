import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/common/prisma.js';
import { pocistiBazo } from './pomoc.js';

describe('podatkovni model', () => {
  beforeEach(pocistiBazo);

  async function osnova() {
    const uporabnik = await prisma.uporabnik.create({
      data: { ime: 'Ana', priimek: 'Novak', ePosta: 'ana@example.com', gesloHash: 'x' },
    });
    const ekipa = await prisma.ekipa.create({ data: { naziv: 'Člani', kategorija: 'CLANI' } });
    const sezona = await prisma.sezona.create({
      data: { naziv: '2026/27', datumZacetka: new Date('2026-07-01'), datumKonca: new Date('2027-06-30') },
    });
    return { uporabnik, ekipa, sezona };
  }

  it('isti uporabnik ne more imeti dveh članstev v isti ekipi in sezoni', async () => {
    const { uporabnik, ekipa, sezona } = await osnova();
    const data = {
      uporabnikId: uporabnik.id,
      ekipaId: ekipa.id,
      sezonaId: sezona.id,
      datumPridruzitve: new Date('2026-07-01'),
    };
    await prisma.clanstvoVEkipi.create({ data });
    await expect(prisma.clanstvoVEkipi.create({ data })).rejects.toThrow();
  });

  it('za igralca in trening obstaja največ ena evidenca prisotnosti', async () => {
    const { uporabnik, ekipa, sezona } = await osnova();
    const trening = await prisma.trening.create({
      data: {
        ekipaId: ekipa.id,
        sezonaId: sezona.id,
        zacetek: new Date('2026-09-01T17:00:00Z'),
        konec: new Date('2026-09-01T18:30:00Z'),
        lokacija: 'Glavno igrišče',
      },
    });
    const data = { treningId: trening.id, igralecId: uporabnik.id };
    const prva = await prisma.prisotnost.create({ data });
    expect(prva.prijavljenaPrisotnost).toBe('NI_ODGOVORA');
    await expect(prisma.prisotnost.create({ data })).rejects.toThrow();
  });

  it('ekipe s treningi ni mogoče izbrisati (zgodovina se ohrani)', async () => {
    const { ekipa, sezona } = await osnova();
    await prisma.trening.create({
      data: {
        ekipaId: ekipa.id,
        sezonaId: sezona.id,
        zacetek: new Date('2026-09-01T17:00:00Z'),
        konec: new Date('2026-09-01T18:30:00Z'),
        lokacija: 'Glavno igrišče',
      },
    });
    await expect(prisma.ekipa.delete({ where: { id: ekipa.id } })).rejects.toThrow();
  });
});
