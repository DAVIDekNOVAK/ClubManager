import { beforeEach, describe, expect, it } from 'vitest';
import { ustvariAplikacijo } from '../src/app.js';
import { dan, dodajDni } from '../src/common/datumi.js';
import { prisma } from '../src/common/prisma.js';
import { E_ADMIN, E_DRUG, E_IGRALEC, E_TRENER, E_VODJA, pocistiBazo, prijavljen, ustvariKlub } from './pomoc.js';

const app = ustvariAplikacijo();
const URA = 3_600_000;
/** Trenutek čez `ur` ur (negativno = v preteklosti). */
const cez = (ur: number) => new Date(Date.now() + ur * URA).toISOString();

describe('US-05 – ustvarjanje treninga', () => {
  let klub: Awaited<ReturnType<typeof ustvariKlub>>;
  beforeEach(async () => {
    await pocistiBazo();
    klub = await ustvariKlub(3);
  });
  const nov = (prepis: Record<string, unknown> = {}) => ({
    ekipaId: klub.ekipa.id, zacetek: cez(48), konec: cez(49.5), lokacija: 'Glavno igrišče', ...prepis,
  });

  it('AC 1: datum, ura začetka, ura konca in lokacija so obvezni; vsebina je neobvezna (do 500 znakov)', async () => {
    const trener = await prijavljen(app, E_TRENER);
    const prazno = await trener.post('/api/treningi').send({ ekipaId: klub.ekipa.id });
    expect(prazno.status).toBe(400);
    expect(Object.keys(prazno.body.polja).sort()).toEqual(['konec', 'lokacija', 'zacetek']);

    const predolgo = await trener.post('/api/treningi').send(nov({ vsebina: 'x'.repeat(501) }));
    expect(predolgo.body.polja.vsebina).toBe('Vsebina treninga ima lahko največ 500 znakov');

    const brezVsebine = await trener.post('/api/treningi').send(nov());
    expect(brezVsebine.status).toBe(201);
    expect(brezVsebine.body.vsebina).toBeNull();
    expect((await trener.post('/api/treningi').send(nov({ vsebina: 'x'.repeat(500) }))).status).toBe(201);
  });

  it('AC 2: začetek ne sme biti v preteklosti, konec mora biti po začetku', async () => {
    const trener = await prijavljen(app, E_TRENER);
    const vPreteklosti = await trener.post('/api/treningi').send(nov({ zacetek: cez(-2), konec: cez(-1) }));
    expect(vPreteklosti.body.polja.zacetek).toBe('Datum in ura začetka ne smeta biti v preteklosti');
    const obrnjeno = await trener.post('/api/treningi').send(nov({ konec: cez(47) }));
    expect(obrnjeno.body.polja.konec).toBe('Ura konca mora biti kasneje od ure začetka');
    const brezSezone = await trener.post('/api/treningi').send(nov({ zacetek: cez(24 * 400), konec: cez(24 * 400 + 1) }));
    expect(brezSezone.body.polja.zacetek).toBe('Za izbrani datum ni določene tekmovalne sezone');
    expect(await prisma.trening.count()).toBe(0);
  });

  it('AC 3: trening je »Načrtovan« in viden v razporedu igralcev ekipe', async () => {
    const trener = await prijavljen(app, E_TRENER);
    const ustvarjen = await trener.post('/api/treningi').send(nov({ vsebina: 'Podaje' }));
    expect(ustvarjen.body).toMatchObject({ status: 'NACRTOVAN', lokacija: 'Glavno igrišče', ekipa: { naziv: 'Člani' }, jeTrener: true });

    const igralec = await prijavljen(app, E_IGRALEC);
    const razpored = await igralec.get('/api/treningi');
    expect(razpored.body).toHaveLength(1);
    expect(razpored.body[0]).toMatchObject({ id: ustvarjen.body.id, jeTrener: false, povzetek: null });
    expect(razpored.body[0].mojaPrisotnost.prijavljenaPrisotnost).toBe('NI_ODGOVORA');

    // Član druge ekipe treninga ne vidi.
    const drug = await prijavljen(app, E_DRUG);
    expect((await drug.get('/api/treningi')).body).toEqual([]);
    expect((await drug.get(`/api/treningi/${ustvarjen.body.id}`)).status).toBe(403);
  });

  it('AC 4: za vsakega igralca ekipe se ustvari evidenca »Ni odgovora«', async () => {
    const trener = await prijavljen(app, E_TRENER);
    const { body } = await trener.post('/api/treningi').send(nov());
    const evidence = await prisma.prisotnost.findMany({ where: { treningId: body.id } });
    expect(evidence.map((e) => e.igralecId).sort()).toEqual(klub.igralci.map((i) => i.id).sort());
    expect(evidence.every((e) => e.prijavljenaPrisotnost === 'NI_ODGOVORA' && e.dejanskaPrisotnost === null)).toBe(true);
    // Trener in vodja ekipe nista igralca, zato evidence nimata.
    expect(body.povzetek).toEqual({ pride: 0, nePride: 0, niOdgovora: 3 });
  });

  it('AC 5: trening lahko ustvari samo trener te ekipe', async () => {
    for (const ePosta of [E_IGRALEC, E_VODJA, E_DRUG, E_ADMIN]) {
      const o = await prijavljen(app, ePosta);
      expect((await o.post('/api/treningi').send(nov())).status, ePosta).toBe(403);
    }
  });

  it('US-04 AC 3: za arhivirano ekipo ni mogoče ustvariti treninga', async () => {
    await prisma.ekipa.update({ where: { id: klub.ekipa.id }, data: { jeArhivirana: true } });
    const trener = await prijavljen(app, E_TRENER);
    expect((await trener.post('/api/treningi').send(nov())).status).toBe(409);
  });

  it('US-03 AC 4: po datumu odhoda igralec ne vidi več prihodnjih treningov ekipe', async () => {
    const trener = await prijavljen(app, E_TRENER);
    await trener.post('/api/treningi').send(nov());
    await prisma.clanstvoVEkipi.updateMany({
      where: { uporabnikId: klub.igralci[0].id },
      data: { datumOdhoda: dodajDni(dan(), -1) },
    });
    const igralec = await prijavljen(app, E_IGRALEC);
    expect((await igralec.get('/api/treningi')).body).toEqual([]);
  });
});
