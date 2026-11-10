import { beforeEach, describe, expect, it } from 'vitest';
import { ustvariAplikacijo } from '../src/app.js';
import { prisma } from '../src/common/prisma.js';
import { E_ADMIN, E_DRUG, E_IGRALEC, E_TRENER, E_VODJA, pocistiBazo, prijavljen, ustvariKlub } from './pomoc.js';

const app = ustvariAplikacijo();
const cez = (ur: number) => new Date(Date.now() + ur * 3_600_000).toISOString();

describe('US-09 – ustvarjanje tekme', () => {
  let klub: Awaited<ReturnType<typeof ustvariKlub>>;
  let nasprotnikId: number;
  beforeEach(async () => {
    await pocistiBazo();
    klub = await ustvariKlub(2);
    nasprotnikId = (await prisma.nasprotniKlub.create({ data: { naziv: 'NK Triglav', kraj: 'Kranj' } })).id;
  });
  const nova = (prepis: Record<string, unknown> = {}) => ({
    ekipaId: klub.ekipa.id, nasprotniKlubId: nasprotnikId, datumInUra: cez(72), jeDomaca: true,
    lokacija: 'Mestni stadion', vrstaTekmovanja: 'PRVENSTVO', ...prepis,
  });

  it('AC 1: nasprotnik iz evidence, datum in ura, domača/gostujoča, lokacija in vrsta tekmovanja so obvezni', async () => {
    const vodja = await prijavljen(app, E_VODJA);
    const prazno = await vodja.post('/api/tekme').send({ ekipaId: klub.ekipa.id });
    expect(prazno.status).toBe(400);
    expect(Object.keys(prazno.body.polja).sort()).toEqual(['datumInUra', 'jeDomaca', 'lokacija', 'nasprotniKlubId', 'vrstaTekmovanja']);

    expect((await vodja.post('/api/tekme').send(nova({ nasprotniKlubId: 9999 }))).body.polja.nasprotniKlubId).toBe('Izberite nasprotni klub iz evidence');
    expect((await vodja.post('/api/tekme').send(nova({ vrstaTekmovanja: 'LIGA' }))).body.polja.vrstaTekmovanja).toBe('Izberite vrsto tekmovanja');
    expect((await vodja.post('/api/tekme').send(nova({ datumInUra: cez(-3) }))).body.polja.datumInUra).toBe('Datum in ura tekme ne smeta biti v preteklosti');
    expect(await prisma.tekma.count()).toBe(0);
  });

  it('AC 2: tekma dobi status »Načrtovana« in je v razporedu vseh članov ekipe', async () => {
    const vodja = await prijavljen(app, E_VODJA);
    const ustvarjena = await vodja.post('/api/tekme').send(nova({ jeDomaca: false, vrstaTekmovanja: 'POKAL' }));
    expect(ustvarjena.status).toBe(201);
    expect(ustvarjena.body).toMatchObject({
      status: 'NACRTOVANA', jeDomaca: false, vrstaTekmovanja: 'POKAL', jeVodja: true, jeTrener: false, rezultat: null,
      nasprotniKlub: { naziv: 'NK Triglav', kraj: 'Kranj' }, ekipa: { naziv: 'Člani' },
    });
    for (const ePosta of [E_IGRALEC, E_TRENER, E_VODJA]) {
      const o = await prijavljen(app, ePosta);
      expect((await o.get('/api/tekme')).body.map((t: { id: number }) => t.id), ePosta).toEqual([ustvarjena.body.id]);
    }
    const drug = await prijavljen(app, E_DRUG);
    expect((await drug.get('/api/tekme')).body).toEqual([]);
    expect((await drug.get(`/api/tekme/${ustvarjena.body.id}`)).status).toBe(403);
  });

  it('AC 3: vodja ekipe lahko tekmo ureja ali odpove, dokler je »Načrtovana«', async () => {
    const vodja = await prijavljen(app, E_VODJA);
    const { body } = await vodja.post('/api/tekme').send(nova());
    const { ekipaId: _, ...podatki } = nova({ lokacija: 'Pomožno igrišče', jeDomaca: false });
    const urejena = await vodja.patch(`/api/tekme/${body.id}`).send(podatki);
    expect(urejena.status).toBe(200);
    expect(urejena.body).toMatchObject({ lokacija: 'Pomožno igrišče', jeDomaca: false });

    const odpovedana = await vodja.post(`/api/tekme/${body.id}/odpovej`);
    expect(odpovedana.body.status).toBe('ODPOVEDANA');
    expect((await vodja.patch(`/api/tekme/${body.id}`).send(podatki)).status).toBe(409);
    expect((await vodja.post(`/api/tekme/${body.id}/odpovej`)).status).toBe(409);

    for (const status of ['ODIGRANA', 'ZAKLJUCENA'] as const) {
      await prisma.tekma.update({ where: { id: body.id }, data: { status } });
      expect((await vodja.patch(`/api/tekme/${body.id}`).send(podatki)).status, status).toBe(409);
      expect((await vodja.post(`/api/tekme/${body.id}/odpovej`)).status, status).toBe(409);
    }
  });

  it('AC 4: vodja ekipe z urejanjem tekme ne more vnesti rezultata', async () => {
    const vodja = await prijavljen(app, E_VODJA);
    const { body } = await vodja.post('/api/tekme').send(nova({ domaciGoli: 3, gostujociGoli: 0, status: 'ZAKLJUCENA' }));
    const { ekipaId: _, ...podatki } = nova({ domaciGoli: 5, gostujociGoli: 1 });
    await vodja.patch(`/api/tekme/${body.id}`).send(podatki);
    const tekma = await prisma.tekma.findUniqueOrThrow({ where: { id: body.id } });
    expect(tekma).toMatchObject({ status: 'NACRTOVANA', domaciGoli: null, gostujociGoli: null });
  });

  it('AC 5: tekmo lahko ustvari samo vodja te ekipe', async () => {
    for (const ePosta of [E_IGRALEC, E_TRENER, E_DRUG, E_ADMIN]) {
      const o = await prijavljen(app, ePosta);
      expect((await o.post('/api/tekme').send(nova())).status, ePosta).toBe(403);
    }
    // Vodja ekipe Člani ne more ustvariti tekme za U17.
    const vodja = await prijavljen(app, E_VODJA);
    expect((await vodja.post('/api/tekme').send(nova({ ekipaId: klub.drugaEkipa.id }))).status).toBe(403);
  });

  it('US-04 AC 3: za arhivirano ekipo ni mogoče ustvariti tekme', async () => {
    await prisma.ekipa.update({ where: { id: klub.ekipa.id }, data: { jeArhivirana: true } });
    const vodja = await prijavljen(app, E_VODJA);
    expect((await vodja.post('/api/tekme').send(nova())).status).toBe(409);
  });
});
