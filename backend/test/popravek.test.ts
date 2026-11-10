import { beforeEach, describe, expect, it } from 'vitest';
import { ustvariAplikacijo } from '../src/app.js';
import { prisma } from '../src/common/prisma.js';
import { E_ADMIN, E_IGRALEC, E_TRENER, E_VODJA, pocistiBazo, prijavljen, ustvariKlub, ustvariTekmo } from './pomoc.js';

const app = ustvariAplikacijo();
const RAZLOG = 'Napačno vpisan strelec drugega gola';

describe('US-13 – popravek zaključenega poročila', () => {
  let klub: Awaited<ReturnType<typeof ustvariKlub>>;
  let tekmaId: number;
  let pot: string;
  let trener: Awaited<ReturnType<typeof prijavljen>>;
  const ig = (n: number) => klub.igralci[n - 1].id;
  const porocilo = (prepis: Record<string, unknown> = {}) => ({
    nasiGoli: 2,
    goliNasprotnika: 1,
    nastopi: klub.igralci.map((i, n) => ({ igralecId: i.id, zacetnaPostava: n < 11, odigraneMinute: n < 11 ? 90 : 0 })),
    dogodki: [
      { vrsta: 'GOL', igralecId: ig(9), minuta: 10 },
      { vrsta: 'GOL', igralecId: ig(9), minuta: 50 },
    ],
    ...prepis,
  });
  const popravljeno = (prepis: Record<string, unknown> = {}) =>
    porocilo({ razlog: RAZLOG, dogodki: [{ vrsta: 'GOL', igralecId: ig(9), minuta: 10 }, { vrsta: 'GOL', igralecId: ig(10), asistentId: ig(9), minuta: 50 }], ...prepis });

  beforeEach(async () => {
    await pocistiBazo();
    klub = await ustvariKlub(13);
    tekmaId = (await ustvariTekmo(klub)).id;
    pot = `/api/tekme/${tekmaId}/porocilo`;
    trener = await prijavljen(app, E_TRENER);
    await trener.post(`${pot}/odpri`);
  });

  it('AC 1: popraviti je mogoče samo zaključeno poročilo in samo trener ekipe', async () => {
    const prezgodaj = await trener.put(`${pot}/popravek`).send(popravljeno());
    expect(prezgodaj.status).toBe(409);
    expect(prezgodaj.body.napaka).toBe('Popraviti je mogoče samo zaključeno poročilo');

    await trener.post(`${pot}/potrdi`).send(porocilo());
    for (const ePosta of [E_IGRALEC, E_VODJA, E_ADMIN]) {
      const o = await prijavljen(app, ePosta);
      expect((await o.put(`${pot}/popravek`).send(popravljeno())).status, ePosta).toBe(403);
    }
    expect((await trener.put(`${pot}/popravek`).send(popravljeno())).status).toBe(200);
  });

  it('AC 2: razlog popravka je obvezen (10–200 znakov)', async () => {
    await trener.post(`${pot}/potrdi`).send(porocilo());
    const brez = await trener.put(`${pot}/popravek`).send(popravljeno({ razlog: undefined }));
    expect(brez.status).toBe(400);
    expect(brez.body.polja.razlog).toBe('Vnesite razlog popravka');
    expect((await trener.put(`${pot}/popravek`).send(popravljeno({ razlog: 'Prekratko' }))).body.polja.razlog).toBe('Razlog popravka mora imeti vsaj 10 znakov');
    expect((await trener.put(`${pot}/popravek`).send(popravljeno({ razlog: 'x'.repeat(201) }))).status).toBe(400);
    expect(await prisma.zgodovinaTekme.count()).toBe(0);
    expect((await trener.put(`${pot}/popravek`).send(popravljeno({ razlog: 'x'.repeat(200) }))).status).toBe(200);
  });

  it('AC 3: zgodovina zabeleži, kdo je naredil spremembo, kdaj, razlog ter stare in nove podatke', async () => {
    await trener.post(`${pot}/potrdi`).send(porocilo());
    await trener.put(`${pot}/popravek`).send(popravljeno({ nasiGoli: 3, dogodki: [...popravljeno().dogodki, { vrsta: 'GOL', igralecId: ig(8), minuta: 88 }] }));

    const zgodovina = (await trener.get(`/api/tekme/${tekmaId}/zgodovina`)).body;
    expect(zgodovina).toHaveLength(1);
    const z = zgodovina[0];
    expect(z).toMatchObject({ razlog: RAZLOG, spremenil: { ime: 'Tine', priimek: 'Trener' } });
    expect(Date.now() - new Date(z.datumSpremembe).getTime()).toBeLessThan(10_000);
    expect(z.stariPodatki.nasiGoli).toBe(2);
    expect(z.stariPodatki.dogodki).toHaveLength(2);
    expect(z.stariPodatki.dogodki[1]).toMatchObject({ igralecId: ig(9), asistentId: null });
    expect(z.noviPodatki.nasiGoli).toBe(3);
    expect(z.noviPodatki.dogodki).toHaveLength(3);
    expect(z.noviPodatki.dogodki[1]).toMatchObject({ igralecId: ig(10), asistentId: ig(9) });
    expect(z.spremembe).toEqual(['Rezultat (naši : nasprotnik): 2 : 1 → 3 : 1', 'Spremenjeni dogodki (prej 2, zdaj 3)']);
  });

  it('AC 4: po popravku so shranjeni novi podatki, tekma ostane »Zaključena«', async () => {
    await trener.post(`${pot}/potrdi`).send(porocilo());
    const nastopi = porocilo().nastopi;
    nastopi[0].odigraneMinute = 45;
    await trener.put(`${pot}/popravek`).send(popravljeno({ nastopi }));

    const shranjeno = (await trener.get(pot)).body;
    expect(shranjeno.tekma.status).toBe('ZAKLJUCENA');
    expect(shranjeno.nastopi[0].odigraneMinute).toBe(45);
    expect(shranjeno.dogodki[1]).toMatchObject({ igralecId: ig(10), asistentId: ig(9) });
    // Popravek mora izpolnjevati iste pogoje kot potrditev.
    const neveljaven = await trener.put(`${pot}/popravek`).send(popravljeno({ nasiGoli: 5 }));
    expect(neveljaven.status).toBe(409);
    expect(neveljaven.body.napaka).toBe('Število golov se ne ujema z rezultatom');
    expect(await prisma.zgodovinaTekme.count()).toBe(1);
  });

  it('AC 5: zgodovino sprememb vidita trener ekipe in administrator, igralci ne', async () => {
    await trener.post(`${pot}/potrdi`).send(porocilo());
    await trener.put(`${pot}/popravek`).send(popravljeno());
    const zgodovina = `/api/tekme/${tekmaId}/zgodovina`;
    expect((await trener.get(zgodovina)).status).toBe(200);
    expect((await (await prijavljen(app, E_ADMIN)).get(zgodovina)).body).toHaveLength(1);
    expect((await (await prijavljen(app, E_IGRALEC)).get(zgodovina)).status).toBe(403);
    expect((await (await prijavljen(app, E_VODJA)).get(zgodovina)).status).toBe(403);
  });
});
