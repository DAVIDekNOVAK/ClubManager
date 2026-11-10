import { beforeEach, describe, expect, it } from 'vitest';
import { ustvariAplikacijo } from '../src/app.js';
import { dan, dodajDni, kotDatum } from '../src/common/datumi.js';
import { prisma } from '../src/common/prisma.js';
import { E_ADMIN, E_TRENER, odjemalec, pocistiBazo, prijavljen, ustvariKlub } from './pomoc.js';

const app = ustvariAplikacijo();
const d = (dni: number) => kotDatum(dodajDni(dan(), dni));

describe('US-01 – ustvarjanje sezone', () => {
  beforeEach(async () => {
    await pocistiBazo();
    await ustvariKlub(0); // aktivna sezona: od -120 do +240 dni
  });

  it('AC 1: obvezna polja in datum konca po datumu začetka', async () => {
    const admin = await prijavljen(app, E_ADMIN);
    const prazno = await admin.post('/api/sezone').send({});
    expect(prazno.status).toBe(400);
    expect(Object.keys(prazno.body.polja).sort()).toEqual(['datumKonca', 'datumZacetka', 'naziv']);

    const obrnjeno = await admin.post('/api/sezone').send({ naziv: 'X', datumZacetka: d(400), datumKonca: d(300) });
    expect(obrnjeno.status).toBe(400);
    expect(obrnjeno.body.polja.datumKonca).toBe('Datum konca mora biti kasnejši od datuma začetka');
  });

  it('AC 2: obdobje se ne sme prekrivati z obstoječo sezono', async () => {
    const admin = await prijavljen(app, E_ADMIN);
    const odgovor = await admin.post('/api/sezone').send({ naziv: 'Nova', datumZacetka: d(200), datumKonca: d(500) });
    expect(odgovor.status).toBe(409);
    expect(odgovor.body.napaka).toBe('Obdobje se prekriva s sezono Aktivna');
    expect(await prisma.sezona.count()).toBe(1);
  });

  it('AC 3: nova sezona je načrtovana, status pa sledi datumom', async () => {
    const admin = await prijavljen(app, E_ADMIN);
    const nova = await admin.post('/api/sezone').send({ naziv: 'Naslednja', datumZacetka: d(241), datumKonca: d(600) });
    expect(nova.status).toBe(201);
    expect(nova.body.status).toBe('NACRTOVANA');

    await prisma.sezona.create({ data: { naziv: 'Stara', datumZacetka: dodajDni(dan(), -500), datumKonca: dodajDni(dan(), -121) } });
    const seznam = await admin.get('/api/sezone');
    expect(seznam.body.map((s: { naziv: string; status: string }) => [s.naziv, s.status])).toEqual([
      ['Naslednja', 'NACRTOVANA'],
      ['Aktivna', 'AKTIVNA'],
      ['Stara', 'ZAKLJUCENA'],
    ]);
  });

  it('AC 5: sezono lahko ustvari samo administrator', async () => {
    const trener = await prijavljen(app, E_TRENER);
    const odgovor = await trener.post('/api/sezone').send({ naziv: 'Naslednja', datumZacetka: d(241), datumKonca: d(600) });
    expect(odgovor.status).toBe(403);
    expect((await odjemalec(app).get('/api/sezone')).status).toBe(401);
    // Seznam sezon vidijo vsi prijavljeni (izbira sezone v statistiki).
    expect((await trener.get('/api/sezone')).status).toBe(200);
  });
});
