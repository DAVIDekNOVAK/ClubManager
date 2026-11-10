import { beforeEach, describe, expect, it } from 'vitest';
import { ustvariAplikacijo } from '../src/app.js';
import { dan, dodajDni, kotDatum } from '../src/common/datumi.js';
import { prisma } from '../src/common/prisma.js';
import { E_ADMIN, E_DRUG, E_IGRALEC, E_TRENER, pocistiBazo, prijavljen, ustvariKlub } from './pomoc.js';

const app = ustvariAplikacijo();
const d = (dni: number) => kotDatum(dodajDni(dan(), dni));

describe('US-03 – dodajanje člana v ekipo', () => {
  let klub: Awaited<ReturnType<typeof ustvariKlub>>;
  beforeEach(async () => {
    await pocistiBazo();
    klub = await ustvariKlub(2);
  });

  const novo = (prepis: Record<string, unknown> = {}) => ({
    uporabnikId: klub.drug.id,
    ekipaId: klub.ekipa.id,
    sezonaId: klub.sezona.id,
    vloge: ['IGRALEC'],
    datumPridruzitve: d(0),
    ...prepis,
  });

  it('AC 1: uporabnik, ekipa, sezona, vsaj ena vloga in datum pridružitve so obvezni', async () => {
    const admin = await prijavljen(app, E_ADMIN);
    const prazno = await admin.post('/api/clanstva').send({});
    expect(prazno.status).toBe(400);
    expect(Object.keys(prazno.body.polja).sort()).toEqual(['datumPridruzitve', 'ekipaId', 'sezonaId', 'uporabnikId', 'vloge']);
    expect((await admin.post('/api/clanstva').send(novo({ vloge: [] }))).body.polja.vloge).toBe('Izberite vsaj eno vlogo');

    const ok = await admin.post('/api/clanstva').send(novo({ vloge: ['IGRALEC', 'VODJA_EKIPE'] }));
    expect(ok.status).toBe(201);
    expect(ok.body.vloge.sort()).toEqual(['IGRALEC', 'VODJA_EKIPE']);
  });

  it('AC 2: istega uporabnika ni mogoče dvakrat dodati v isto ekipo in sezono', async () => {
    const admin = await prijavljen(app, E_ADMIN);
    const odgovor = await admin.post('/api/clanstva').send(novo({ uporabnikId: klub.trener.id }));
    expect(odgovor.status).toBe(409);
    expect(odgovor.body.napaka).toBe('Uporabnik je že član te ekipe v izbrani sezoni');
  });

  it('AC 3 in AC 5: uporabnik je lahko v več ekipah z različnimi vlogami; nova ekipa je vidna v profilu', async () => {
    const admin = await prijavljen(app, E_ADMIN);
    const drug = await prijavljen(app, E_DRUG);
    expect((await drug.get('/api/auth/jaz')).body.ekipe.map((e: { naziv: string }) => e.naziv)).toEqual(['U17']);

    expect((await admin.post('/api/clanstva').send(novo())).status).toBe(201);

    const profil = (await drug.get('/api/auth/jaz')).body;
    expect(profil.ekipe).toHaveLength(2);
    expect(profil.clanstva.map((c: { ekipa: { naziv: string }; vloge: string[] }) => [c.ekipa.naziv, c.vloge])).toEqual([
      ['Člani', ['IGRALEC']],
      ['U17', ['TRENER']],
    ]);
    // Administrator vidi profil uporabnika z vsemi članstvi, drug uporabnik ne.
    expect((await admin.get(`/api/uporabniki/${klub.drug.id}`)).body.clanstva).toHaveLength(2);
    expect((await drug.get(`/api/uporabniki/${klub.trener.id}`)).status).toBe(403);
  });

  it('AC 4: datum odhoda članstva ne izbriše, uporabnik pa ekipe ne vidi več med trenutnimi', async () => {
    const admin = await prijavljen(app, E_ADMIN);
    const clanstvo = await prisma.clanstvoVEkipi.findFirstOrThrow({ where: { uporabnikId: klub.igralci[0].id } });

    const prezgodaj = await admin.patch(`/api/clanstva/${clanstvo.id}`).send({ datumOdhoda: d(-200) });
    expect(prezgodaj.body.polja.datumOdhoda).toBe('Datum odhoda ne sme biti pred datumom pridružitve');

    const odgovor = await admin.patch(`/api/clanstva/${clanstvo.id}`).send({ datumOdhoda: d(-1) });
    expect(odgovor.status).toBe(200);
    expect(await prisma.clanstvoVEkipi.count({ where: { id: clanstvo.id } })).toBe(1);

    const igralec = await prijavljen(app, E_IGRALEC);
    const profil = (await igralec.get('/api/auth/jaz')).body;
    expect(profil.ekipe).toEqual([]);
    expect(profil.clanstva).toHaveLength(1);
    expect(profil.clanstva[0].jeAktivno).toBe(false);

    const clani = await admin.get(`/api/ekipe/${klub.ekipa.id}/clanstva?sezonaId=${klub.sezona.id}`);
    const zapis = clani.body.find((c: { id: number }) => c.id === clanstvo.id);
    expect(zapis.jeOdsel).toBe(true);
  });

  it('članstva lahko ureja samo administrator; e-pošto članov vidijo le administrator, trener in vodja', async () => {
    const trener = await prijavljen(app, E_TRENER);
    expect((await trener.post('/api/clanstva').send(novo())).status).toBe(403);
    expect((await trener.get('/api/uporabniki')).status).toBe(403);

    const pot = `/api/ekipe/${klub.ekipa.id}/clanstva?sezonaId=${klub.sezona.id}`;
    expect((await trener.get(pot)).body[0].uporabnik.ePosta).toBeDefined();
    const igralec = await prijavljen(app, E_IGRALEC);
    const seznam = await igralec.get(pot);
    expect(seznam.body).toHaveLength(4);
    expect(seznam.body[0].uporabnik.ePosta).toBeUndefined();
    expect((await (await prijavljen(app, E_DRUG)).get(pot)).status).toBe(403);
  });
});
