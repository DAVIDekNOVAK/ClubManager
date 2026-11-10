import { beforeEach, describe, expect, it } from 'vitest';
import { ustvariAplikacijo } from '../src/app.js';
import { dan, dodajDni } from '../src/common/datumi.js';
import { prisma } from '../src/common/prisma.js';
import { E_ADMIN, E_IGRALEC, E_TRENER, E_VODJA, pocistiBazo, prijavljen, ustvariKlub, ustvariTekmo } from './pomoc.js';

const app = ustvariAplikacijo();

describe('US-11 – vnos rezultata in postave', () => {
  let klub: Awaited<ReturnType<typeof ustvariKlub>>;
  let tekmaId: number;
  let pot: string;
  /** Poročilo s prvimi `zacetnih` igralci v začetni postavi in naslednjimi `klop` na klopi. */
  const porocilo = (zacetnih = 11, klop = 2, prepis: Record<string, unknown> = {}) => ({
    nasiGoli: 2,
    goliNasprotnika: 1,
    nastopi: klub.igralci.slice(0, zacetnih + klop).map((i, n) => ({ igralecId: i.id, zacetnaPostava: n < zacetnih, odigraneMinute: n < zacetnih ? 90 : 0 })),
    ...prepis,
  });

  beforeEach(async () => {
    await pocistiBazo();
    klub = await ustvariKlub(14);
    tekmaId = (await ustvariTekmo(klub)).id;
    pot = `/api/tekme/${tekmaId}/porocilo`;
  });

  it('AC 1: poročilo lahko odpre samo trener ekipe in šele po terminu tekme; tekma postane »Odigrana«', async () => {
    const prihodnja = await ustvariTekmo(klub, -24);
    const trener = await prijavljen(app, E_TRENER);
    const prezgodaj = await trener.post(`/api/tekme/${prihodnja.id}/porocilo/odpri`);
    expect(prezgodaj.status).toBe(409);
    expect(prezgodaj.body.napaka).toBe('Poročilo je mogoče odpreti šele po terminu tekme');

    for (const ePosta of [E_IGRALEC, E_VODJA, E_ADMIN]) {
      const o = await prijavljen(app, ePosta);
      expect((await o.post(`${pot}/odpri`)).status, ePosta).toBe(403);
    }
    // Brez odprtja poročila ni mogoče shraniti.
    expect((await trener.put(pot).send(porocilo())).status).toBe(409);

    const odprto = await trener.post(`${pot}/odpri`);
    expect(odprto.body.status).toBe('ODIGRANA');
    expect((await prisma.tekma.findUniqueOrThrow({ where: { id: tekmaId } })).status).toBe('ODIGRANA');
    // Osnutka ne vidita ne igralec ne vodja ekipe.
    expect((await (await prijavljen(app, E_IGRALEC)).get(pot)).status).toBe(403);
    expect((await (await prijavljen(app, E_VODJA)).get(pot)).status).toBe(403);
  });

  it('AC 2: izbrati je mogoče samo igralce z veljavnim članstvom na dan tekme', async () => {
    const trener = await prijavljen(app, E_TRENER);
    await trener.post(`${pot}/odpri`);
    // Igralec 14 je iz ekipe odšel pred tekmo.
    await prisma.clanstvoVEkipi.updateMany({ where: { uporabnikId: klub.igralci[13].id }, data: { datumOdhoda: dodajDni(dan(), -2) } });

    const seznam = (await trener.get(pot)).body.igralci;
    expect(seznam).toHaveLength(13);
    const zOdslim = await trener.put(pot).send(porocilo(11, 3));
    expect(zOdslim.status).toBe(400);
    expect(zOdslim.body.napaka).toBe('V poročilu so lahko samo igralci z veljavnim članstvom v ekipi na dan tekme');
    // Trener ni igralec.
    const sTrenerjem = porocilo(11, 0);
    sTrenerjem.nastopi.push({ igralecId: klub.trener.id, zacetnaPostava: false, odigraneMinute: 0 });
    expect((await trener.put(pot).send(sTrenerjem)).status).toBe(400);
  });

  it('AC 2: poškodovanega ali odsotnega igralca je mogoče izbrati šele po potrditvi opozorila', async () => {
    const trener = await prijavljen(app, E_TRENER);
    await trener.post(`${pot}/odpri`);
    const poskodovan = klub.igralci[0];
    await prisma.razpolozljivostIgralca.create({ data: { igralecId: poskodovan.id, status: 'POSKODOVAN', veljaOd: dodajDni(dan(), -5) } });
    await prisma.razpolozljivostIgralca.create({ data: { igralecId: klub.igralci[1].id, status: 'OMEJENO_TRENIRANJE', veljaOd: dodajDni(dan(), -5) } });

    const igralci = (await trener.get(pot)).body.igralci;
    expect(igralci.filter((i: { zahtevaPotrditev: boolean }) => i.zahtevaPotrditev).map((i: { igralecId: number }) => i.igralecId)).toEqual([poskodovan.id]);

    const brezPotrditve = await trener.put(pot).send(porocilo());
    expect(brezPotrditve.status).toBe(400);
    expect(brezPotrditve.body.napaka).toContain('status »Poškodovan«');
    expect(brezPotrditve.body.polja.opozorilo).toBe(String(poskodovan.id));

    expect((await trener.put(pot).send(porocilo(11, 2, { potrjenaOpozorila: [poskodovan.id] }))).status).toBe(200);
  });

  it('AC 3: začetna postava mora imeti natanko 11 igralcev, sicer poročila ni mogoče potrditi', async () => {
    const trener = await prijavljen(app, E_TRENER);
    await trener.post(`${pot}/odpri`);
    const premalo = await trener.post(`${pot}/potrdi`).send(porocilo(10, 2));
    expect(premalo.status).toBe(409);
    expect(premalo.body.napaka).toBe('Začetna postava mora imeti natanko 11 igralcev (izbranih: 10)');
    expect((await trener.put(pot).send(porocilo(12, 0))).body.napaka).toBe('V začetni postavi je lahko največ 11 igralcev');
    // Osnutek z nepopolno postavo se shrani, preverjanje pa pove, kaj manjka.
    const osnutek = await trener.put(pot).send(porocilo(10, 2, { nasiGoli: null, goliNasprotnika: null }));
    expect(osnutek.status).toBe(200);
    expect(osnutek.body.preverjanje).toEqual(['Vnesite rezultat tekme', 'Začetna postava mora imeti natanko 11 igralcev (izbranih: 10)']);
    expect((await prisma.tekma.findUniqueOrThrow({ where: { id: tekmaId } })).status).toBe('ODIGRANA');
  });

  it('AC 4: odigrane minute so celo število od 0 do 120', async () => {
    const trener = await prijavljen(app, E_TRENER);
    await trener.post(`${pot}/odpri`);
    for (const minute of [-1, 121, 45.5, '90', null]) {
      const p = porocilo();
      (p.nastopi[0] as { odigraneMinute: unknown }).odigraneMinute = minute;
      expect((await trener.put(pot).send(p)).status, String(minute)).toBe(400);
    }
    const p = porocilo();
    p.nastopi[0].odigraneMinute = 120;
    p.nastopi[12].odigraneMinute = 0;
    expect((await trener.put(pot).send(p)).status).toBe(200);
  });

  it('AC 5: osnutek se shrani, po potrditvi je tekma »Zaključena« z rezultatom', async () => {
    const trener = await prijavljen(app, E_TRENER);
    await trener.post(`${pot}/odpri`);
    expect((await trener.put(pot).send(porocilo(11, 2, { nasiGoli: 1 }))).body.status).toBe('ODIGRANA');
    const shranjeno = (await trener.get(pot)).body;
    expect(shranjeno).toMatchObject({ nasiGoli: 1, goliNasprotnika: 1 });
    expect(shranjeno.nastopi).toHaveLength(13);
    expect(shranjeno.tekma.rezultat).toBeNull();

    const potrjeno = await trener.post(`${pot}/potrdi`).send(porocilo());
    expect(potrjeno.status).toBe(200);
    const tekma = await prisma.tekma.findUniqueOrThrow({ where: { id: tekmaId } });
    expect(tekma).toMatchObject({ status: 'ZAKLJUCENA', domaciGoli: 2, gostujociGoli: 1 });
    expect(await prisma.nastopNaTekmi.count({ where: { tekmaId, zacetnaPostava: true } })).toBe(11);

    // Zaključeno poročilo vidijo člani ekipe; običajno urejanje ni več mogoče.
    const igralec = await prijavljen(app, E_IGRALEC);
    expect((await igralec.get(pot)).body.tekma.rezultat).toEqual({ nasiGoli: 2, goliNasprotnika: 1 });
    expect((await trener.put(pot).send(porocilo())).status).toBe(409);
  });

  it('pri gostujoči tekmi se naši goli shranijo kot goli gostov', async () => {
    const gostujoca = await ustvariTekmo(klub, 5, { jeDomaca: false });
    const trener = await prijavljen(app, E_TRENER);
    await trener.post(`/api/tekme/${gostujoca.id}/porocilo/odpri`);
    await trener.post(`/api/tekme/${gostujoca.id}/porocilo/potrdi`).send(porocilo(11, 0, { nasiGoli: 3, goliNasprotnika: 0 }));
    expect(await prisma.tekma.findUniqueOrThrow({ where: { id: gostujoca.id } })).toMatchObject({ domaciGoli: 0, gostujociGoli: 3 });
  });
});
