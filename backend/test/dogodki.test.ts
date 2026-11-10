import { beforeEach, describe, expect, it } from 'vitest';
import { ustvariAplikacijo } from '../src/app.js';
import { prisma } from '../src/common/prisma.js';
import { E_TRENER, pocistiBazo, prijavljen, ustvariKlub, ustvariTekmo } from './pomoc.js';

const app = ustvariAplikacijo();

describe('US-12 – vnos dogodkov na tekmi', () => {
  let klub: Awaited<ReturnType<typeof ustvariKlub>>;
  let tekmaId: number;
  let pot: string;
  let trener: Awaited<ReturnType<typeof prijavljen>>;
  /** Id igralca: 1–11 so v začetni postavi, 12–14 na klopi. */
  const ig = (n: number) => klub.igralci[n - 1].id;
  const porocilo = (dogodki: Record<string, unknown>[], nasiGoli: number | null = null) => ({
    nasiGoli,
    goliNasprotnika: nasiGoli === null ? null : 0,
    nastopi: klub.igralci.map((i, n) => ({ igralecId: i.id, zacetnaPostava: n < 11, odigraneMinute: n < 11 ? 90 : 0 })),
    dogodki,
  });
  const shrani = (dogodki: Record<string, unknown>[]) => trener.put(pot).send(porocilo(dogodki));

  beforeEach(async () => {
    await pocistiBazo();
    klub = await ustvariKlub(14);
    tekmaId = (await ustvariTekmo(klub)).id;
    pot = `/api/tekme/${tekmaId}/porocilo`;
    trener = await prijavljen(app, E_TRENER);
    await trener.post(`${pot}/odpri`);
  });

  it('AC 1: dogodek ima vrsto, igralca in minuto (1–120); dogodki so vrnjeni kronološko', async () => {
    expect((await shrani([{ vrsta: 'AVTOGOL', igralecId: ig(1), minuta: 5 }])).status).toBe(400);
    expect((await shrani([{ vrsta: 'GOL', minuta: 5 }])).status).toBe(400);
    for (const minuta of [0, 121, 12.5, null]) {
      expect((await shrani([{ vrsta: 'GOL', igralecId: ig(1), minuta }])).status, String(minuta)).toBe(400);
    }
    // Dogodek se lahko nanaša samo na igralce iz poročila.
    expect((await shrani([{ vrsta: 'GOL', igralecId: klub.trener.id, minuta: 5 }])).status).toBe(400);

    const ok = await shrani([
      { vrsta: 'GOL', igralecId: ig(9), minuta: 81 },
      { vrsta: 'RUMENI_KARTON', igralecId: ig(4), minuta: 38 },
      { vrsta: 'MENJAVA', igralecId: ig(7), vstopilIgralecId: ig(12), minuta: 65 },
      { vrsta: 'GOL', igralecId: ig(9), asistentId: ig(4), minuta: 1 },
      { vrsta: 'RDECI_KARTON', igralecId: ig(2), minuta: 120 },
    ]);
    expect(ok.status).toBe(200);
    const { dogodki } = (await trener.get(pot)).body;
    expect(dogodki.map((d: { minuta: number; vrsta: string }) => [d.minuta, d.vrsta])).toEqual([
      [1, 'GOL'], [38, 'RUMENI_KARTON'], [65, 'MENJAVA'], [81, 'GOL'], [120, 'RDECI_KARTON'],
    ]);
    expect(dogodki[0]).toMatchObject({ igralecId: ig(9), asistentId: ig(4) });
    expect(dogodki[2]).toMatchObject({ igralecId: ig(7), vstopilIgralecId: ig(12) });
  });

  it('AC 2: število golov se mora ujemati z rezultatom, sicer poročila ni mogoče potrditi', async () => {
    const enGol = [{ vrsta: 'GOL', igralecId: ig(9), minuta: 12 }];
    const neujemanje = await trener.post(`${pot}/potrdi`).send(porocilo(enGol, 2));
    expect(neujemanje.status).toBe(409);
    expect(neujemanje.body.napaka).toBe('Število golov se ne ujema z rezultatom');
    // Osnutek se shrani, preverjanje pa opozori na neujemanje.
    expect((await trener.put(pot).send(porocilo(enGol, 2))).body.preverjanje).toEqual(['Število golov se ne ujema z rezultatom']);

    const dvaGola = [...enGol, { vrsta: 'GOL', igralecId: ig(10), minuta: 70 }];
    expect((await trener.post(`${pot}/potrdi`).send(porocilo(dvaGola, 2))).status).toBe(200);
    expect((await prisma.tekma.findUniqueOrThrow({ where: { id: tekmaId } })).status).toBe('ZAKLJUCENA');
  });

  it('AC 3: asistenca je vezana na gol in je ne more imeti strelec', async () => {
    const samoasistenca = await shrani([{ vrsta: 'GOL', igralecId: ig(9), asistentId: ig(9), minuta: 12 }]);
    expect(samoasistenca.status).toBe(400);
    expect(samoasistenca.body.napaka).toBe('Asistence ne more imeti isti igralec, ki je dosegel gol');
    expect((await shrani([{ vrsta: 'RUMENI_KARTON', igralecId: ig(9), asistentId: ig(8), minuta: 12 }])).body.napaka).toBe('Asistenca je lahko vezana samo na gol');

    await shrani([{ vrsta: 'GOL', igralecId: ig(9), asistentId: ig(8), minuta: 12 }]);
    const gol = await prisma.dogodekNaTekmi.findFirstOrThrow({ where: { tekmaId, vrstaDogodka: 'GOL' } });
    const asistenca = await prisma.dogodekNaTekmi.findFirstOrThrow({ where: { tekmaId, vrstaDogodka: 'ASISTENCA' } });
    expect(asistenca).toMatchObject({ igralecId: ig(8), golId: gol.id, minuta: 12 });
  });

  it('AC 4: pri menjavi mora biti igralec, ki vstopi, na klopi', async () => {
    const brezVstopa = await shrani([{ vrsta: 'MENJAVA', igralecId: ig(7), minuta: 60 }]);
    expect(brezVstopa.body.napaka).toBe('Pri menjavi izberite igralca, ki vstopi');
    const izPostave = await shrani([{ vrsta: 'MENJAVA', igralecId: ig(7), vstopilIgralecId: ig(8), minuta: 60 }]);
    expect(izPostave.status).toBe(400);
    expect(izPostave.body.napaka).toBe('Igralec, ki vstopi, mora biti na klopi in ne v začetni postavi');
    // Igrišče lahko zapusti samo igralec, ki je na igrišču; isti igralec ne more vstopiti dvakrat.
    expect((await shrani([{ vrsta: 'MENJAVA', igralecId: ig(13), vstopilIgralecId: ig(12), minuta: 60 }])).status).toBe(400);
    expect((await shrani([
      { vrsta: 'MENJAVA', igralecId: ig(7), vstopilIgralecId: ig(12), minuta: 60 },
      { vrsta: 'MENJAVA', igralecId: ig(8), vstopilIgralecId: ig(12), minuta: 70 },
    ])).status).toBe(400);

    // Igralec, ki je vstopil, je lahko kasneje zamenjan.
    expect((await shrani([
      { vrsta: 'MENJAVA', igralecId: ig(7), vstopilIgralecId: ig(12), minuta: 60 },
      { vrsta: 'MENJAVA', igralecId: ig(12), vstopilIgralecId: ig(13), minuta: 80 },
    ])).status).toBe(200);
  });

  it('AC 5: igralec z rdečim kartonom po minuti izključitve ne more imeti novih dogodkov', async () => {
    const rdeci = { vrsta: 'RDECI_KARTON', igralecId: ig(5), minuta: 40 };
    const golPoIzkljucitvi = await shrani([rdeci, { vrsta: 'GOL', igralecId: ig(5), minuta: 55 }]);
    expect(golPoIzkljucitvi.status).toBe(400);
    expect(golPoIzkljucitvi.body.napaka).toContain('izključen');
    expect((await shrani([rdeci, { vrsta: 'GOL', igralecId: ig(9), asistentId: ig(5), minuta: 41 }])).status).toBe(400);
    expect((await shrani([rdeci, { vrsta: 'MENJAVA', igralecId: ig(5), vstopilIgralecId: ig(12), minuta: 50 }])).status).toBe(400);
    expect((await shrani([rdeci, { ...rdeci, minuta: 30 }])).status).toBe(400);

    // Dogodki pred izključitvijo in v isti minuti (npr. drugi rumeni karton) so dovoljeni.
    expect((await shrani([
      rdeci,
      { vrsta: 'GOL', igralecId: ig(5), minuta: 20 },
      { vrsta: 'RUMENI_KARTON', igralecId: ig(5), minuta: 40 },
      { vrsta: 'GOL', igralecId: ig(9), minuta: 80 },
    ])).status).toBe(200);
  });
});
