import { beforeEach, describe, expect, it } from 'vitest';
import { ustvariAplikacijo } from '../src/app.js';
import { prisma } from '../src/common/prisma.js';
import { E_ADMIN, E_IGRALEC, E_TRENER, pocistiBazo, prijavljen, ustvariKlub } from './pomoc.js';

const app = ustvariAplikacijo();

describe('US-02 – ustvarjanje ekipe', () => {
  beforeEach(async () => {
    await pocistiBazo();
    await ustvariKlub(2);
  });

  it('AC 1: naziv (2–50 znakov) in kategorija s seznama sta obvezna', async () => {
    const admin = await prijavljen(app, E_ADMIN);
    const prazno = await admin.post('/api/ekipe').send({});
    expect(prazno.status).toBe(400);
    expect(Object.keys(prazno.body.polja).sort()).toEqual(['kategorija', 'naziv']);

    expect((await admin.post('/api/ekipe').send({ naziv: 'A', kategorija: 'U15' })).status).toBe(400);
    expect((await admin.post('/api/ekipe').send({ naziv: 'x'.repeat(51), kategorija: 'U15' })).status).toBe(400);
    expect((await admin.post('/api/ekipe').send({ naziv: 'Kadeti', kategorija: 'U16' })).body.polja.kategorija).toBe('Izberite kategorijo');
    expect(await prisma.ekipa.count()).toBe(2);
  });

  it('AC 2: naziv je unikaten med nearhiviranimi ekipami', async () => {
    const admin = await prijavljen(app, E_ADMIN);
    const podvojena = await admin.post('/api/ekipe').send({ naziv: 'člani', kategorija: 'CLANI' });
    expect(podvojena.status).toBe(409);
    expect(podvojena.body.polja.naziv).toBe('Ekipa s tem nazivom že obstaja');

    // Naziv arhivirane ekipe je mogoče ponovno uporabiti.
    await prisma.ekipa.updateMany({ where: { naziv: 'Člani' }, data: { jeArhivirana: true } });
    expect((await admin.post('/api/ekipe').send({ naziv: 'Člani', kategorija: 'CLANI' })).status).toBe(201);
  });

  it('AC 3: nova ekipa je na seznamu, aktivna in brez članov', async () => {
    const admin = await prijavljen(app, E_ADMIN);
    const nova = await admin.post('/api/ekipe').send({ naziv: '  U15 A ', kategorija: 'U15' });
    expect(nova.status).toBe(201);
    expect(nova.body).toMatchObject({ naziv: 'U15 A', kategorija: 'U15', jeArhivirana: false, steviloClanov: 0 });

    const seznam = await admin.get('/api/ekipe');
    expect(seznam.body.map((e: { naziv: string; steviloClanov: number }) => [e.naziv, e.steviloClanov])).toEqual([
      ['Člani', 4],
      ['U15 A', 0],
      ['U17', 1],
    ]);
  });

  it('AC 4: ekipo lahko ustvari samo administrator', async () => {
    const trener = await prijavljen(app, E_TRENER);
    expect((await trener.post('/api/ekipe').send({ naziv: 'U15', kategorija: 'U15' })).status).toBe(403);
  });

  it('uporabnik vidi samo svoje ekipe', async () => {
    const igralec = await prijavljen(app, E_IGRALEC);
    const seznam = await igralec.get('/api/ekipe');
    expect(seznam.body.map((e: { naziv: string }) => e.naziv)).toEqual(['Člani']);

    const u17 = await prisma.ekipa.findFirstOrThrow({ where: { naziv: 'U17' } });
    expect((await igralec.get(`/api/ekipe/${u17.id}`)).status).toBe(403);
    const clani = await prisma.ekipa.findFirstOrThrow({ where: { naziv: 'Člani' } });
    expect((await igralec.get(`/api/ekipe/${clani.id}`)).body.mojeVloge).toEqual(['IGRALEC']);
  });
});
