import { beforeEach, describe, expect, it } from 'vitest';
import { ustvariAplikacijo } from '../src/app.js';
import { prisma } from '../src/common/prisma.js';
import { E_ADMIN, E_DRUG, E_IGRALEC, E_TRENER, E_VODJA, izvedenTrening, pocistiBazo, prijavljen, ustvariKlub, zakljucenaTekma } from './pomoc.js';

const app = ustvariAplikacijo();

describe('US-15 – pregled statistike ekipe', () => {
  let klub: Awaited<ReturnType<typeof ustvariKlub>>;
  let pot: string;
  beforeEach(async () => {
    await pocistiBazo();
    klub = await ustvariKlub(12);
    pot = `/api/statistika/ekipa/${klub.ekipa.id}`;
    // Zmaga 2:1, remi 1:1, poraz 0:3 in osnutek, ki se ne šteje.
    await zakljucenaTekma(klub, { goli: [[0, 1], [0]], goliNasprotnika: 1, urNazaj: 72, kartoni: [[2, 'RUMENI_KARTON']] });
    await zakljucenaTekma(klub, { goli: [[1]], goliNasprotnika: 1, urNazaj: 48 });
    await zakljucenaTekma(klub, { goli: [], goliNasprotnika: 3, urNazaj: 24, kartoni: [[2, 'RDECI_KARTON']] });
    await zakljucenaTekma(klub, { goli: [[0], [0], [0]], status: 'ODIGRANA', urNazaj: 5 });
    await izvedenTrening(klub, 2);
    await izvedenTrening(klub, 4, [0, 1, 2]);
  });

  it('AC 1: povzetek ekipe – tekme, zmage, remiji, porazi, dani in prejeti goli', async () => {
    const trener = await prijavljen(app, E_TRENER);
    const odgovor = await trener.get(pot);
    expect(odgovor.status).toBe(200);
    expect(odgovor.body.sezonaId).toBe(klub.sezona.id);
    expect(odgovor.body.povzetek).toEqual({ tekme: 3, zmage: 1, remiji: 1, porazi: 1, daniGoli: 3, prejetiGoli: 5, povprecnaPrisotnost: 88 });
    // Zadnje tekme od najnovejše proti starejšim.
    expect(odgovor.body.zadnjeTekme.map((t: { izid: string }) => t.izid)).toEqual(['P', 'R', 'Z']);
    expect(odgovor.body.najboljsiStrelec).toEqual({ ime: 'Igralec1', priimek: 'Priimek01', goli: 2 });
  });

  it('AC 2: tabela igralcev z nastopi, minutami, goli, asistencami, kartoni in prisotnostjo', async () => {
    const trener = await prijavljen(app, E_TRENER);
    const { igralci } = (await trener.get(pot)).body;
    expect(igralci).toHaveLength(12);
    expect(igralci[0]).toMatchObject({ ime: 'Igralec1', nastopi: 3, zacetnePostave: 3, minute: 270, goli: 2, asistence: 0, prisotnost: 50 });
    expect(igralci[1]).toMatchObject({ goli: 1, asistence: 1 });
    expect(igralci[2]).toMatchObject({ rumeniKartoni: 1, rdeciKartoni: 1 });
    expect(igralci[3]).toMatchObject({ prisotnost: 100 });
    expect(igralci[11]).toMatchObject({ nastopi: 0, minute: 0 });
  });

  it('AC 3: podrobna statistika igralca po sezonah je trenerju na voljo', async () => {
    const trener = await prijavljen(app, E_TRENER);
    const podrobno = await trener.get(`/api/statistika/igralec/${klub.igralci[0].id}`);
    expect(podrobno.status).toBe(200);
    expect(podrobno.body.poSezonah[0].statistika).toMatchObject({ nastopi: 3, goli: 2 });
  });

  it('AC 4: trener vidi samo svoje ekipe, administrator vse', async () => {
    const trener = await prijavljen(app, E_TRENER);
    expect((await trener.get(`/api/statistika/ekipa/${klub.drugaEkipa.id}`)).status).toBe(403);
    const drug = await prijavljen(app, E_DRUG); // trener U17
    expect((await drug.get(pot)).status).toBe(403);
    expect((await drug.get(`/api/statistika/ekipa/${klub.drugaEkipa.id}`)).status).toBe(200);
    const admin = await prijavljen(app, E_ADMIN);
    expect((await admin.get(pot)).status).toBe(200);
    expect((await admin.get(`/api/statistika/ekipa/${klub.drugaEkipa.id}`)).status).toBe(200);
    expect((await (await prijavljen(app, E_IGRALEC)).get(pot)).status).toBe(403);
    expect((await (await prijavljen(app, E_VODJA)).get(pot)).status).toBe(403);
  });

  it('filter po vrsti tekmovanja in sezoni', async () => {
    await prisma.tekma.updateMany({ where: { gostujociGoli: 3 }, data: { vrstaTekmovanja: 'POKAL' } });
    const trener = await prijavljen(app, E_TRENER);
    expect((await trener.get(`${pot}?vrstaTekmovanja=POKAL`)).body.povzetek).toMatchObject({ tekme: 1, porazi: 1, daniGoli: 0 });
    expect((await trener.get(`${pot}?vrstaTekmovanja=PRVENSTVO`)).body.povzetek).toMatchObject({ tekme: 2, zmage: 1, remiji: 1 });
    const stara = await prisma.sezona.create({ data: { naziv: 'Stara', datumZacetka: new Date('2020-07-01'), datumKonca: new Date('2021-06-30') } });
    const prazno = (await trener.get(`${pot}?sezonaId=${stara.id}`)).body;
    expect(prazno.povzetek.tekme).toBe(0);
    expect(prazno.igralci).toEqual([]);
  });
});
