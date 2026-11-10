import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { ustvariAplikacijo } from '../src/app.js';
import { prisma } from '../src/common/prisma.js';
import { GESLO, odjemalec, pocistiBazo, prijavljen, ustvariUporabnika } from './pomoc.js';

const app = ustvariAplikacijo();
const E = 'trener@example.com';

describe('US-20 – prijava in odjava', () => {
  beforeEach(async () => {
    await pocistiBazo();
    await ustvariUporabnika({ ePosta: E, ime: 'Tine', priimek: 'Trener' });
  });

  it('pravilni podatki prijavijo uporabnika in nastavijo piškotek HttpOnly', async () => {
    const odgovor = await odjemalec(app).post('/api/auth/prijava').send({ ePosta: E, geslo: GESLO });
    expect(odgovor.status).toBe(200);
    expect(odgovor.body).toMatchObject({ ePosta: E, ime: 'Tine', ekipe: [] });
    expect(odgovor.body.gesloHash).toBeUndefined();
    const piskotek = String(odgovor.headers['set-cookie']);
    expect(piskotek).toContain('HttpOnly');
    expect(piskotek).toContain('SameSite=Lax');
  });

  it('e-poštni naslov ni občutljiv na velike črke', async () => {
    const odgovor = await odjemalec(app).post('/api/auth/prijava').send({ ePosta: 'Trener@Example.com', geslo: GESLO });
    expect(odgovor.status).toBe(200);
  });

  it('AC 2: napačno geslo in neznan naslov vrneta enako sporočilo', async () => {
    const napacnoGeslo = await odjemalec(app).post('/api/auth/prijava').send({ ePosta: E, geslo: 'napacno' });
    const neznanNaslov = await odjemalec(app).post('/api/auth/prijava').send({ ePosta: 'x@example.com', geslo: GESLO });
    expect(napacnoGeslo.status).toBe(401);
    expect(neznanNaslov.status).toBe(401);
    expect(napacnoGeslo.body.napaka).toBe('Napačen e-poštni naslov ali geslo');
    expect(neznanNaslov.body.napaka).toBe(napacnoGeslo.body.napaka);
  });

  it('AC 3: po 5 zaporednih neuspešnih poskusih je prijava onemogočena za 15 minut', async () => {
    const o = odjemalec(app);
    for (let i = 0; i < 5; i++) {
      const odgovor = await o.post('/api/auth/prijava').send({ ePosta: E, geslo: 'napacno' });
      expect(odgovor.status).toBe(401);
    }
    const zaklenjen = await o.post('/api/auth/prijava').send({ ePosta: E, geslo: GESLO });
    expect(zaklenjen.status).toBe(429);
    expect(zaklenjen.body.napaka).toContain('začasno onemogočena');

    const u = await prisma.uporabnik.findUniqueOrThrow({ where: { ePosta: E } });
    const minut = (u.zaklenjenDo!.getTime() - Date.now()) / 60_000;
    expect(minut).toBeGreaterThan(14);
    expect(minut).toBeLessThanOrEqual(15);

    // Ko zaklep poteče, je prijava spet mogoča.
    await prisma.uporabnik.update({ where: { id: u.id }, data: { zaklenjenDo: new Date(Date.now() - 1000) } });
    const poIzteku = await o.post('/api/auth/prijava').send({ ePosta: E, geslo: GESLO });
    expect(poIzteku.status).toBe(200);
  });

  it('AC 3: poskusi, starejši od 15 minut, se ne štejejo; uspešna prijava števec ponastavi', async () => {
    const o = odjemalec(app);
    for (let i = 0; i < 4; i++) await o.post('/api/auth/prijava').send({ ePosta: E, geslo: 'napacno' });
    await prisma.uporabnik.update({
      where: { ePosta: E },
      data: { prviNeuspesenPoskus: new Date(Date.now() - 16 * 60_000) },
    });
    await o.post('/api/auth/prijava').send({ ePosta: E, geslo: 'napacno' });
    let u = await prisma.uporabnik.findUniqueOrThrow({ where: { ePosta: E } });
    expect(u.zaklenjenDo).toBeNull();
    expect(u.neuspesniPoskusi).toBe(1);

    expect((await o.post('/api/auth/prijava').send({ ePosta: E, geslo: GESLO })).status).toBe(200);
    u = await prisma.uporabnik.findUniqueOrThrow({ where: { ePosta: E } });
    expect(u.neuspesniPoskusi).toBe(0);
  });

  it('AC 4: odjava uniči sejo na strežniku', async () => {
    const o = await prijavljen(app, E);
    expect((await o.get('/api/auth/jaz')).status).toBe(200);
    expect(await prisma.seja.count()).toBe(1);

    expect((await o.post('/api/auth/odjava')).status).toBe(204);
    expect(await prisma.seja.count()).toBe(0);
    expect((await o.get('/api/auth/jaz')).status).toBe(401);
  });

  it('neprijavljen uporabnik dobi 401', async () => {
    const odgovor = await odjemalec(app).get('/api/auth/jaz');
    expect(odgovor.status).toBe(401);
  });

  it('zahteva brez glave X-Requested-With je zavrnjena (zaščita pred CSRF)', async () => {
    const odgovor = await request(app).post('/api/auth/prijava').send({ ePosta: E, geslo: GESLO });
    expect(odgovor.status).toBe(403);
  });

  it('odgovori API-ja se ne shranjujejo v predpomnilnik brskalnika', async () => {
    const o = await prijavljen(app, E);
    expect((await o.get('/api/auth/jaz')).headers['cache-control']).toBe('no-store');
  });
});
