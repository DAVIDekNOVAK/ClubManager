import { beforeEach, describe, expect, it } from 'vitest';
import { ustvariAplikacijo } from '../src/app.js';
import { poslanaPosta } from '../src/common/posta.js';
import { prisma } from '../src/common/prisma.js';
import { zgostiZeton } from '../src/modules/povabila/zeton.js';
import { E_ADMIN, E_TRENER, pocistiBazo, prijavljen, ustvariKlub } from './pomoc.js';

const app = ustvariAplikacijo();
const NOV = 'nov.clan@example.com';
/** Iz besedila e-pošte prebere žeton iz povezave. */
const zetonIzPoste = (besedilo: string) => besedilo.match(/\/povabilo\/([\w-]+)/)![1];

describe('US-18 – pošiljanje povabila', () => {
  let klub: Awaited<ReturnType<typeof ustvariKlub>>;
  beforeEach(async () => {
    await pocistiBazo();
    poslanaPosta.length = 0;
    klub = await ustvariKlub(0);
  });
  const novo = (prepis: Record<string, unknown> = {}) => ({
    ePosta: NOV, ekipaId: klub.ekipa.id, sezonaId: klub.sezona.id, vloga: 'IGRALEC', ...prepis,
  });

  it('AC 1: povabilo zahteva e-pošto, ekipo, sezono in vlogo ter pošlje e-pošto s povezavo', async () => {
    const admin = await prijavljen(app, E_ADMIN);
    const prazno = await admin.post('/api/povabila').send({});
    expect(Object.keys(prazno.body.polja).sort()).toEqual(['ePosta', 'ekipaId', 'sezonaId', 'vloga']);
    expect((await admin.post('/api/povabila').send(novo({ ePosta: 'ni-naslov' }))).body.polja.ePosta).toBe('Vnesite veljaven e-poštni naslov');
    expect(poslanaPosta).toHaveLength(0);

    const odgovor = await admin.post('/api/povabila').send(novo({ ePosta: ' Nov.Clan@Example.com ' }));
    expect(odgovor.status).toBe(201);
    expect(odgovor.body).toMatchObject({ ePosta: NOV, vloga: 'IGRALEC', status: 'POSLANO', ekipa: { naziv: 'Člani' } });
    expect(poslanaPosta).toHaveLength(1);
    expect(poslanaPosta[0].za).toBe(NOV);
    expect(poslanaPosta[0].besedilo).toMatch(/http:\/\/localhost:5173\/povabilo\/[\w-]{40,}/);
    expect(poslanaPosta[0].besedilo).toContain('igralec ekipe Člani');
  });

  it('AC 2: žeton je enkraten, v bazi je samo zgoščena vrednost, povezava velja 7 dni', async () => {
    const admin = await prijavljen(app, E_ADMIN);
    await admin.post('/api/povabila').send(novo());
    const zeton = zetonIzPoste(poslanaPosta[0].besedilo);
    const povabilo = await prisma.povabilo.findFirstOrThrow();
    expect(povabilo.zgoscenaVrednostZetona).toBe(zgostiZeton(zeton));
    expect(povabilo.zgoscenaVrednostZetona).not.toContain(zeton);
    const dni = (povabilo.datumPoteka.getTime() - povabilo.poslanoOb.getTime()) / 86_400_000;
    expect(dni).toBeCloseTo(7, 3);
  });

  it('AC 3: za obstoječega uporabnika se povabilo ne pošlje', async () => {
    const admin = await prijavljen(app, E_ADMIN);
    const odgovor = await admin.post('/api/povabila').send(novo({ ePosta: E_TRENER }));
    expect(odgovor.status).toBe(409);
    expect(odgovor.body.napaka).toBe('Uporabnik že obstaja – dodajte ga v ekipo');
    expect(poslanaPosta).toHaveLength(0);
    expect(await prisma.povabilo.count()).toBe(0);
  });

  it('AC 4: seznam s statusi in ponovno pošiljanje poteklega povabila', async () => {
    const admin = await prijavljen(app, E_ADMIN);
    const { body: povabilo } = await admin.post('/api/povabila').send(novo());
    const stariZeton = zetonIzPoste(poslanaPosta[0].besedilo);
    await admin.post('/api/povabila').send(novo({ ePosta: 'sprejet@example.com' }));
    await prisma.povabilo.updateMany({ where: { ePosta: 'sprejet@example.com' }, data: { datumSprejetja: new Date() } });
    await prisma.povabilo.update({ where: { id: povabilo.id }, data: { datumPoteka: new Date(Date.now() - 1000) } });

    const seznam = await admin.get('/api/povabila');
    expect(Object.fromEntries(seznam.body.map((p: { ePosta: string; status: string }) => [p.ePosta, p.status]))).toEqual({
      [NOV]: 'POTEKLO',
      'sprejet@example.com': 'SPREJETO',
    });

    const ponovljeno = await admin.post(`/api/povabila/${povabilo.id}/ponovi`);
    expect(ponovljeno.status).toBe(200);
    expect(ponovljeno.body.status).toBe('POSLANO');
    expect(poslanaPosta).toHaveLength(3);
    const noviZeton = zetonIzPoste(poslanaPosta[2].besedilo);
    expect(noviZeton).not.toBe(stariZeton);
    expect((await prisma.povabilo.findUniqueOrThrow({ where: { id: povabilo.id } })).zgoscenaVrednostZetona).toBe(zgostiZeton(noviZeton));

    const sprejeto = seznam.body.find((p: { status: string }) => p.status === 'SPREJETO');
    expect((await admin.post(`/api/povabila/${sprejeto.id}/ponovi`)).status).toBe(409);
  });

  it('za isti naslov ne moreta hkrati obstajati dve veljavni povabili', async () => {
    const admin = await prijavljen(app, E_ADMIN);
    await admin.post('/api/povabila').send(novo());
    expect((await admin.post('/api/povabila').send(novo())).status).toBe(409);
  });

  it('povabila upravlja samo administrator', async () => {
    const trener = await prijavljen(app, E_TRENER);
    expect((await trener.post('/api/povabila').send(novo())).status).toBe(403);
    expect((await trener.get('/api/povabila')).status).toBe(403);
  });
});
