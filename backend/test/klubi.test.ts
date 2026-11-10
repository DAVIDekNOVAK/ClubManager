import { beforeEach, describe, expect, it } from 'vitest';
import { ustvariAplikacijo } from '../src/app.js';
import { prisma } from '../src/common/prisma.js';
import { E_ADMIN, E_IGRALEC, E_TRENER, E_VODJA, pocistiBazo, prijavljen, ustvariKlub } from './pomoc.js';

const app = ustvariAplikacijo();
const nazivi = (telo: { naziv: string }[]) => telo.map((k) => k.naziv);

describe('US-10 – evidenca nasprotnih klubov', () => {
  let klub: Awaited<ReturnType<typeof ustvariKlub>>;
  beforeEach(async () => {
    await pocistiBazo();
    klub = await ustvariKlub(1);
    await prisma.nasprotniKlub.createMany({
      data: [{ naziv: 'NK Triglav', kraj: 'Kranj' }, { naziv: 'NK Krka', kraj: 'Novo mesto' }, { naziv: 'ŠD Šmartno', kraj: 'Šmartno' }],
    });
  });

  it('AC 1: naziv (2–80 znakov) in kraj sta obvezna', async () => {
    const vodja = await prijavljen(app, E_VODJA);
    const prazno = await vodja.post('/api/nasprotni-klubi').send({});
    expect(prazno.status).toBe(400);
    expect(Object.keys(prazno.body.polja).sort()).toEqual(['kraj', 'naziv']);
    expect((await vodja.post('/api/nasprotni-klubi').send({ naziv: 'N', kraj: 'Ptuj' })).status).toBe(400);
    expect((await vodja.post('/api/nasprotni-klubi').send({ naziv: 'x'.repeat(81), kraj: 'Ptuj' })).status).toBe(400);
    expect((await vodja.post('/api/nasprotni-klubi').send({ naziv: 'NK Drava', kraj: '  ' })).status).toBe(400);
    expect(await prisma.nasprotniKlub.count()).toBe(3);

    const ok = await vodja.post('/api/nasprotni-klubi').send({ naziv: 'NK Drava', kraj: 'Ptuj' });
    expect(ok.status).toBe(201);
    expect(ok.body).toMatchObject({ naziv: 'NK Drava', kraj: 'Ptuj', steviloTekem: 0 });
  });

  it('AC 2: kluba z enakim nazivom in krajem ni mogoče dodati', async () => {
    const vodja = await prijavljen(app, E_VODJA);
    const podvojen = await vodja.post('/api/nasprotni-klubi').send({ naziv: 'nk triglav', kraj: 'KRANJ' });
    expect(podvojen.status).toBe(409);
    expect(podvojen.body.napaka).toBe('Klub že obstaja v evidenci');
    // Enak naziv v drugem kraju je dovoljen.
    expect((await vodja.post('/api/nasprotni-klubi').send({ naziv: 'NK Triglav', kraj: 'Bohinj' })).status).toBe(201);
  });

  it('AC 3: iskanje po vsaj 2 znakih vrne klube, katerih naziv vsebuje besedilo', async () => {
    const vodja = await prijavljen(app, E_VODJA);
    expect((await vodja.get('/api/nasprotni-klubi?iskanje=k')).body).toEqual([]);
    expect(nazivi((await vodja.get('/api/nasprotni-klubi?iskanje=nk')).body)).toEqual(['NK Krka', 'NK Triglav']);
    expect(nazivi((await vodja.get('/api/nasprotni-klubi?iskanje=RIGL')).body)).toEqual(['NK Triglav']);
    expect(nazivi((await vodja.get('/api/nasprotni-klubi?iskanje=šmar')).body)).toEqual(['ŠD Šmartno']);
    expect((await vodja.get('/api/nasprotni-klubi')).body).toHaveLength(3);
  });

  it('AC 4: kluba s tekmo ni mogoče izbrisati, mogoče pa ga je urejati', async () => {
    const vodja = await prijavljen(app, E_VODJA);
    const [triglav, krka] = await prisma.nasprotniKlub.findMany({ orderBy: { id: 'asc' } });
    await prisma.tekma.create({
      data: {
        ekipaId: klub.ekipa.id, sezonaId: klub.sezona.id, nasprotniKlubId: triglav.id,
        datumInUra: new Date(Date.now() + 86_400_000), jeDomaca: true, lokacija: 'Stadion', vrstaTekmovanja: 'PRVENSTVO',
      },
    });
    const brisanje = await vodja.delete(`/api/nasprotni-klubi/${triglav.id}`);
    expect(brisanje.status).toBe(409);
    expect(brisanje.body.napaka).toBe('Kluba, ki je povezan z vsaj eno tekmo, ni mogoče izbrisati');

    const urejanje = await vodja.patch(`/api/nasprotni-klubi/${triglav.id}`).send({ naziv: 'NK Triglav Kranj', kraj: 'Kranj' });
    expect(urejanje.status).toBe(200);
    expect(urejanje.body.naziv).toBe('NK Triglav Kranj');
    // Pri urejanju velja ista prepoved podvajanja.
    expect((await vodja.patch(`/api/nasprotni-klubi/${triglav.id}`).send({ naziv: 'NK Krka', kraj: 'Novo mesto' })).status).toBe(409);

    expect((await vodja.delete(`/api/nasprotni-klubi/${krka.id}`)).status).toBe(204);
    expect((await vodja.get('/api/nasprotni-klubi')).body.find((k: { id: number }) => k.id === triglav.id).steviloTekem).toBe(1);
  });

  it('evidenco ureja samo vodja ekipe, berejo jo vsi prijavljeni', async () => {
    for (const ePosta of [E_IGRALEC, E_TRENER, E_ADMIN]) {
      const o = await prijavljen(app, ePosta);
      expect((await o.post('/api/nasprotni-klubi').send({ naziv: 'NK Drava', kraj: 'Ptuj' })).status, ePosta).toBe(403);
      expect((await o.get('/api/nasprotni-klubi')).status).toBe(200);
    }
  });
});
