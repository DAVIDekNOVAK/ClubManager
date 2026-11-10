import { beforeEach, describe, expect, it } from 'vitest';
import { ustvariAplikacijo } from '../src/app.js';
import { dan, dodajDni, kotDatum } from '../src/common/datumi.js';
import { prisma } from '../src/common/prisma.js';
import { statusiNaDan } from '../src/modules/razpolozljivost/skupno.js';
import { E_ADMIN, E_IGRALEC, E_TRENER, E_VODJA, pocistiBazo, prijavljen, ustvariKlub } from './pomoc.js';

const app = ustvariAplikacijo();
const d = (dni: number) => kotDatum(dodajDni(dan(), dni));

describe('US-16 – posodobitev razpoložljivosti', () => {
  let klub: Awaited<ReturnType<typeof ustvariKlub>>;
  beforeEach(async () => {
    await pocistiBazo();
    klub = await ustvariKlub(2);
  });

  it('AC 1: igralec izbere status, datum začetka (privzeto danes) in neobvezen datum konca', async () => {
    const igralec = await prijavljen(app, E_IGRALEC);
    expect((await igralec.get('/api/razpolozljivost/moja')).body).toEqual({ trenutni: { status: 'NA_VOLJO', veljaOd: null, veljaDo: null }, zgodovina: [] });

    expect((await igralec.post('/api/razpolozljivost').send({})).body.polja.status).toBe('Izberite status');
    expect((await igralec.post('/api/razpolozljivost').send({ status: 'BOLAN' })).status).toBe(400);
    expect((await igralec.post('/api/razpolozljivost').send({ status: 'ODSOTEN', veljaOd: d(-1) })).body.polja.veljaOd).toBe('Datum začetka ne sme biti v preteklosti');
    expect((await igralec.post('/api/razpolozljivost').send({ status: 'ODSOTEN', veljaOd: d(3), veljaDo: d(1) })).body.polja.veljaDo).toBe('Datum konca ne sme biti pred datumom začetka');

    const odgovor = await igralec.post('/api/razpolozljivost').send({ status: 'POSKODOVAN' });
    expect(odgovor.status).toBe(201);
    expect(odgovor.body.trenutni).toMatchObject({ status: 'POSKODOVAN', veljaDo: null });
    expect(odgovor.body.trenutni.veljaOd.slice(0, 10)).toBe(d(0));
    for (const status of ['NA_VOLJO', 'ODSOTEN', 'OMEJENO_TRENIRANJE']) {
      expect((await igralec.post('/api/razpolozljivost').send({ status, veljaDo: d(5) })).status, status).toBe(201);
    }
  });

  it('AC 2: prejšnjemu statusu se nastavi datum konca, oba ostaneta v zgodovini', async () => {
    await prisma.razpolozljivostIgralca.create({ data: { igralecId: klub.igralci[0].id, status: 'POSKODOVAN', veljaOd: dodajDni(dan(), -10) } });
    const igralec = await prijavljen(app, E_IGRALEC);
    const odgovor = await igralec.post('/api/razpolozljivost').send({ status: 'OMEJENO_TRENIRANJE' });

    expect(odgovor.body.trenutni.status).toBe('OMEJENO_TRENIRANJE');
    const zgodovina = odgovor.body.zgodovina.map((z: { status: string; veljaOd: string; veljaDo: string | null }) => [z.status, z.veljaOd.slice(0, 10), z.veljaDo?.slice(0, 10) ?? null]);
    expect(zgodovina).toEqual([
      ['OMEJENO_TRENIRANJE', d(0), null],
      ['POSKODOVAN', d(-10), d(-1)],
    ]);
  });

  it('AC 3: po izteku datuma konca je status samodejno »Na voljo«', async () => {
    const id = klub.igralci[0].id;
    await prisma.razpolozljivostIgralca.create({ data: { igralecId: id, status: 'ODSOTEN', veljaOd: dodajDni(dan(), -5), veljaDo: dodajDni(dan(), 2) } });
    const naDan = async (dni: number) => (await statusiNaDan([id], dodajDni(dan(), dni))).get(id)!.status;
    expect(await naDan(-6)).toBe('NA_VOLJO');
    expect(await naDan(0)).toBe('ODSOTEN');
    expect(await naDan(2)).toBe('ODSOTEN');
    expect(await naDan(3)).toBe('NA_VOLJO');

    await prisma.razpolozljivostIgralca.updateMany({ data: { veljaDo: dodajDni(dan(), -1) } });
    const igralec = await prijavljen(app, E_IGRALEC);
    expect((await igralec.get('/api/razpolozljivost/moja')).body.trenutni.status).toBe('NA_VOLJO');
  });

  it('AC 4: trener vidi nov status v pregledu razpoložljivosti ekipe', async () => {
    const igralec = await prijavljen(app, E_IGRALEC);
    await igralec.post('/api/razpolozljivost').send({ status: 'POSKODOVAN', veljaDo: d(7) });
    const trener = await prijavljen(app, E_TRENER);
    const pregled = await trener.get(`/api/ekipe/${klub.ekipa.id}/razpolozljivost`);
    expect(pregled.status).toBe(200);
    expect(pregled.body.igralci.map((i: { ime: string; status: string }) => [i.ime, i.status])).toEqual([
      ['Igralec1', 'POSKODOVAN'],
      ['Igralec2', 'NA_VOLJO'],
    ]);
    expect(pregled.body.povzetek).toEqual({ NA_VOLJO: 1, OMEJENO_TRENIRANJE: 0, POSKODOVAN: 1, ODSOTEN: 0 });
    // Čez 8 dni je poškodba že mimo.
    const kasneje = await trener.get(`/api/ekipe/${klub.ekipa.id}/razpolozljivost?datum=${d(8)}`);
    expect(kasneje.body.povzetek.NA_VOLJO).toBe(2);
  });

  it('razpoložljivost posodabljajo samo igralci; pregled ekipe vidita trener in administrator', async () => {
    for (const ePosta of [E_TRENER, E_VODJA, E_ADMIN]) {
      const o = await prijavljen(app, ePosta);
      expect((await o.post('/api/razpolozljivost').send({ status: 'ODSOTEN' })).status, ePosta).toBe(403);
    }
    const pot = `/api/ekipe/${klub.ekipa.id}/razpolozljivost`;
    expect((await (await prijavljen(app, E_IGRALEC)).get(pot)).status).toBe(403);
    expect((await (await prijavljen(app, E_VODJA)).get(pot)).status).toBe(403);
    expect((await (await prijavljen(app, E_ADMIN)).get(pot)).status).toBe(200);
  });
});
