import { beforeEach, describe, expect, it } from 'vitest';
import { ustvariAplikacijo } from '../src/app.js';
import { prisma } from '../src/common/prisma.js';
import { E_IGRALEC, E_TRENER, E_VODJA, pocistiBazo, prijavljen, ustvariKlub } from './pomoc.js';

const app = ustvariAplikacijo();
const cez = (ur: number) => new Date(Date.now() + ur * 3_600_000).toISOString();

describe('US-07 – potrjevanje udeležbe na treningu', () => {
  let klub: Awaited<ReturnType<typeof ustvariKlub>>;
  let treningId: number;
  let pot: string;

  beforeEach(async () => {
    await pocistiBazo();
    klub = await ustvariKlub(3);
    const trener = await prijavljen(app, E_TRENER);
    treningId = (await trener.post('/api/treningi').send({ ekipaId: klub.ekipa.id, zacetek: cez(24), konec: cez(25.5), lokacija: 'Igrišče' })).body.id;
    pot = `/api/treningi/${treningId}/udelezba/${klub.igralci[0].id}`;
  });

  it('AC 1: igralec potrdi udeležbo; izbrani odgovor je vrnjen v razporedu', async () => {
    const igralec = await prijavljen(app, E_IGRALEC);
    const odgovor = await igralec.put(pot).send({ odgovor: 'PRIDE' });
    expect(odgovor.status).toBe(200);
    expect(odgovor.body.prijavljenaPrisotnost).toBe('PRIDE');
    expect((await igralec.get('/api/treningi')).body[0].mojaPrisotnost.prijavljenaPrisotnost).toBe('PRIDE');
  });

  it('AC 2: ob »Ne pridem« je razlog obvezen, komentar je neobvezen in omejen na 200 znakov', async () => {
    const igralec = await prijavljen(app, E_IGRALEC);
    const brezRazloga = await igralec.put(pot).send({ odgovor: 'NE_PRIDE' });
    expect(brezRazloga.status).toBe(400);
    expect(brezRazloga.body.polja.razlog).toBe('Izberite razlog odsotnosti');
    expect((await igralec.put(pot).send({ odgovor: 'NE_PRIDE', razlog: 'DOPUST' })).status).toBe(400);
    const predolg = await igralec.put(pot).send({ odgovor: 'NE_PRIDE', razlog: 'BOLEZEN', komentar: 'x'.repeat(201) });
    expect(predolg.body.polja.komentar).toBe('Komentar ima lahko največ 200 znakov');

    const brezKomentarja = await igralec.put(pot).send({ odgovor: 'NE_PRIDE', razlog: 'SOLA_SLUZBA' });
    expect(brezKomentarja.body).toMatchObject({ prijavljenaPrisotnost: 'NE_PRIDE', razlogOdsotnosti: 'SOLA_SLUZBA', komentar: null });
    const zKomentarjem = await igralec.put(pot).send({ odgovor: 'NE_PRIDE', razlog: 'BOLEZEN', komentar: 'Vročina' });
    expect(zKomentarjem.body).toMatchObject({ razlogOdsotnosti: 'BOLEZEN', komentar: 'Vročina' });
  });

  it('AC 3: odgovor je mogoče spremeniti do začetka treninga, potem ne več', async () => {
    const igralec = await prijavljen(app, E_IGRALEC);
    await igralec.put(pot).send({ odgovor: 'NE_PRIDE', razlog: 'BOLEZEN', komentar: 'Vročina' });
    const sprememba = await igralec.put(pot).send({ odgovor: 'PRIDE' });
    // Ob spremembi v »Pridem« se razlog in komentar pobrišeta.
    expect(sprememba.body).toMatchObject({ prijavljenaPrisotnost: 'PRIDE', razlogOdsotnosti: null, komentar: null });

    await prisma.trening.update({ where: { id: treningId }, data: { zacetek: new Date(Date.now() - 60_000) } });
    const prepozno = await igralec.put(pot).send({ odgovor: 'NE_PRIDE', razlog: 'DRUGO' });
    expect(prepozno.status).toBe(409);
    expect(prepozno.body.napaka).toBe('Udeležbe po začetku treninga ni več mogoče spremeniti');
    expect((await igralec.get(`/api/treningi/${treningId}`)).body.seJeZacel).toBe(true);
  });

  it('AC 4: trener vidi število potrjenih, odsotnih in brez odgovora', async () => {
    const igralec1 = await prijavljen(app, E_IGRALEC);
    await igralec1.put(pot).send({ odgovor: 'PRIDE' });
    const igralec2 = await prijavljen(app, 'igralec2@example.com');
    await igralec2.put(`/api/treningi/${treningId}/udelezba/${klub.igralci[1].id}`).send({ odgovor: 'NE_PRIDE', razlog: 'POSKODBA' });

    const trener = await prijavljen(app, E_TRENER);
    expect((await trener.get(`/api/treningi/${treningId}`)).body.povzetek).toEqual({ pride: 1, nePride: 1, niOdgovora: 1 });
    // Igralec povzetka ne vidi.
    expect((await igralec1.get(`/api/treningi/${treningId}`)).body.povzetek).toBeNull();
  });

  it('AC 5: igralec lahko potrjuje samo svojo udeležbo', async () => {
    const igralec = await prijavljen(app, E_IGRALEC);
    const tuja = await igralec.put(`/api/treningi/${treningId}/udelezba/${klub.igralci[1].id}`).send({ odgovor: 'PRIDE' });
    expect(tuja.status).toBe(403);
    const drugi = await prisma.prisotnost.findFirstOrThrow({ where: { treningId, igralecId: klub.igralci[1].id } });
    expect(drugi.prijavljenaPrisotnost).toBe('NI_ODGOVORA');

    // Trener in vodja ekipe nista igralca in udeležbe ne potrjujeta.
    const trener = await prijavljen(app, E_TRENER);
    expect((await trener.put(`/api/treningi/${treningId}/udelezba/${klub.trener.id}`).send({ odgovor: 'PRIDE' })).status).toBe(403);
    const vodja = await prijavljen(app, E_VODJA);
    expect((await vodja.put(`/api/treningi/${treningId}/udelezba/${klub.vodja.id}`).send({ odgovor: 'PRIDE' })).status).toBe(403);
  });

  it('US-06 AC 3: pri odpovedanem treningu udeležbe ni mogoče potrditi', async () => {
    const trener = await prijavljen(app, E_TRENER);
    await trener.post(`/api/treningi/${treningId}/odpovej`);
    const igralec = await prijavljen(app, E_IGRALEC);
    const odgovor = await igralec.put(pot).send({ odgovor: 'PRIDE' });
    expect(odgovor.status).toBe(409);
    expect(odgovor.body.napaka).toContain('odpovedan');
  });
});
