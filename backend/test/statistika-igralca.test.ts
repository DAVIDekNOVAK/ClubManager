import { beforeEach, describe, expect, it } from 'vitest';
import { ustvariAplikacijo } from '../src/app.js';
import { dan, dodajDni } from '../src/common/datumi.js';
import { prisma } from '../src/common/prisma.js';
import { dodajClana, E_ADMIN, E_DRUG, E_IGRALEC, E_TRENER, E_VODJA, izvedenTrening, pocistiBazo, prijavljen, ustvariKlub, zakljucenaTekma } from './pomoc.js';

const app = ustvariAplikacijo();

describe('US-14 – pregled osebne statistike', () => {
  let klub: Awaited<ReturnType<typeof ustvariKlub>>;
  let pot: string;
  beforeEach(async () => {
    await pocistiBazo();
    klub = await ustvariKlub(12);
    pot = `/api/statistika/igralec/${klub.igralci[0].id}`;
  });

  it('AC 1: nastopi, začetne postave, minute, goli, asistence, kartoni in odstotek prisotnosti', async () => {
    await zakljucenaTekma(klub, { goli: [[0, 1], [0], [1, 0]], kartoni: [[0, 'RUMENI_KARTON']] });
    await zakljucenaTekma(klub, { goli: [[0]], kartoni: [[0, 'RUMENI_KARTON'], [0, 'RDECI_KARTON']], urNazaj: 48 });
    await izvedenTrening(klub, 3);
    await izvedenTrening(klub, 5, [0]);
    await izvedenTrening(klub, 7);

    const igralec = await prijavljen(app, E_IGRALEC);
    const odgovor = await igralec.get(pot);
    expect(odgovor.status).toBe(200);
    expect(odgovor.body.statistika).toEqual({
      nastopi: 2, zacetnePostave: 2, minute: 180, goli: 3, asistence: 1, rumeniKartoni: 2, rdeciKartoni: 1,
      treningiIzvedeni: 3, treningiPrisoten: 2, prisotnost: 67,
    });
    expect(odgovor.body.imaPodatke).toBe(true);
    // Igralec, ki je ostal na klopi brez minut, nima nastopa.
    const rezerva = await prijavljen(app, 'igralec12@example.com');
    expect((await rezerva.get(`/api/statistika/igralec/${klub.igralci[11].id}`)).body.statistika).toMatchObject({ nastopi: 0, zacetnePostave: 0, minute: 0 });
  });

  it('AC 2: filter po sezoni (privzeto trenutna) in ekipi, tudi za pretekle sezone in ekipe', async () => {
    const lani = await prisma.sezona.create({ data: { naziv: 'Lanska', datumZacetka: dodajDni(dan(), -500), datumKonca: dodajDni(dan(), -121) } });
    // Igralec je lani igral za U17, od koder je že odšel.
    const lanskoClanstvo = await dodajClana(klub.igralci[0].id, klub.drugaEkipa.id, lani.id, ['IGRALEC'], dodajDni(dan(), -500));
    await prisma.clanstvoVEkipi.update({ where: { id: lanskoClanstvo.id }, data: { datumOdhoda: dodajDni(dan(), -130) } });
    await zakljucenaTekma(klub, { goli: [[0], [0]], sezonaId: lani.id, ekipaId: klub.drugaEkipa.id });
    await zakljucenaTekma(klub, { goli: [[0]] });

    const igralec = await prijavljen(app, E_IGRALEC);
    const privzeto = (await igralec.get(pot)).body;
    expect(privzeto.sezonaId).toBe(klub.sezona.id);
    expect(privzeto.statistika.goli).toBe(1);
    expect(privzeto.sezone.map((s: { naziv: string }) => s.naziv)).toEqual(['Aktivna', 'Lanska']);
    expect(privzeto.ekipe.map((e: { naziv: string }) => e.naziv)).toEqual(['Člani', 'U17']);
    expect(privzeto.poSezonah.map((p: { sezona: { naziv: string }; statistika: { goli: number } }) => [p.sezona.naziv, p.statistika.goli])).toEqual([['Aktivna', 1], ['Lanska', 2]]);

    expect((await igralec.get(`${pot}?sezonaId=${lani.id}`)).body.statistika).toMatchObject({ goli: 2, nastopi: 1 });
    expect((await igralec.get(`${pot}?sezonaId=${lani.id}&ekipaId=${klub.ekipa.id}`)).body.statistika.goli).toBe(0);
    expect((await igralec.get(`${pot}?sezonaId=${lani.id}&ekipaId=${klub.drugaEkipa.id}`)).body.statistika.goli).toBe(2);
  });

  it('AC 3: odstotek prisotnosti šteje samo izvedene treninge v času članstva; odpovedani se ne štejejo', async () => {
    await izvedenTrening(klub, 2);
    await izvedenTrening(klub, 4, [0]);
    await izvedenTrening(klub, 6, [], 'ODPOVEDAN');
    await izvedenTrening(klub, 8, [], 'NACRTOVAN');
    // Trening pred 150 dnevi je bil pred pridružitvijo igralca (članstvo velja zadnjih 100 dni).
    await izvedenTrening(klub, 110, [0]);

    const igralec = await prijavljen(app, E_IGRALEC);
    expect((await igralec.get(pot)).body.statistika).toMatchObject({ treningiIzvedeni: 2, treningiPrisoten: 1, prisotnost: 50 });
  });

  it('AC 4: upoštevajo se samo zaključene tekme, osnutki poročil ne', async () => {
    await zakljucenaTekma(klub, { goli: [[0]] });
    await zakljucenaTekma(klub, { goli: [[0], [0]], status: 'ODIGRANA', urNazaj: 5 });
    const igralec = await prijavljen(app, E_IGRALEC);
    expect((await igralec.get(pot)).body.statistika).toMatchObject({ nastopi: 1, goli: 1, minute: 90 });
  });

  it('AC 5: brez nastopov in treningov v sezoni ni podatkov', async () => {
    const igralec = await prijavljen(app, E_IGRALEC);
    const odgovor = (await igralec.get(pot)).body;
    expect(odgovor.imaPodatke).toBe(false);
    expect(odgovor.statistika).toMatchObject({ nastopi: 0, prisotnost: null });
  });

  it('US-13 AC 4: po popravku poročila statistika upošteva nove podatke', async () => {
    const tekma = await zakljucenaTekma(klub, { goli: [[0]] });
    const trener = await prijavljen(app, E_TRENER);
    const igralec = await prijavljen(app, E_IGRALEC);
    expect((await igralec.get(pot)).body.statistika.goli).toBe(1);

    const popravek = await trener.put(`/api/tekme/${tekma.id}/porocilo/popravek`).send({
      razlog: 'Gol je dosegel drug igralec',
      nasiGoli: 1,
      goliNasprotnika: 0,
      nastopi: klub.igralci.slice(0, 12).map((i, n) => ({ igralecId: i.id, zacetnaPostava: n < 11, odigraneMinute: n === 0 ? 60 : n < 11 ? 90 : 0 })),
      dogodki: [{ vrsta: 'GOL', igralecId: klub.igralci[1].id, asistentId: klub.igralci[0].id, minuta: 10 }],
    });
    expect(popravek.status).toBe(200);
    expect((await igralec.get(pot)).body.statistika).toMatchObject({ goli: 0, asistence: 1, minute: 60 });
  });

  it('statistiko igralca vidijo igralec sam, trener njegove ekipe in administrator', async () => {
    expect((await (await prijavljen(app, E_TRENER)).get(pot)).status).toBe(200);
    expect((await (await prijavljen(app, E_ADMIN)).get(pot)).status).toBe(200);
    expect((await (await prijavljen(app, 'igralec2@example.com')).get(pot)).status).toBe(403);
    expect((await (await prijavljen(app, E_VODJA)).get(pot)).status).toBe(403);
    expect((await (await prijavljen(app, E_DRUG)).get(pot)).status).toBe(403);
  });
});
