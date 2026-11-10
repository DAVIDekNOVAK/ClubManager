import { beforeEach, describe, expect, it } from 'vitest';
import { ustvariAplikacijo } from '../src/app.js';
import { prisma } from '../src/common/prisma.js';
import { E_IGRALEC, E_TRENER, E_VODJA, pocistiBazo, prijavljen, ustvariKlub } from './pomoc.js';

const app = ustvariAplikacijo();
const cez = (ur: number) => new Date(Date.now() + ur * 3_600_000).toISOString();

describe('US-06 – sprememba in odpoved treninga', () => {
  let klub: Awaited<ReturnType<typeof ustvariKlub>>;
  let treningId: number;
  const termin = (prepis: Record<string, unknown> = {}) => ({ zacetek: cez(48), konec: cez(49.5), lokacija: 'Glavno igrišče', vsebina: null, ...prepis });

  beforeEach(async () => {
    await pocistiBazo();
    klub = await ustvariKlub(2);
    const trener = await prijavljen(app, E_TRENER);
    treningId = (await trener.post('/api/treningi').send({ ekipaId: klub.ekipa.id, ...termin() })).body.id;
  });

  it('AC 1: trener lahko spremeni datum, uro, lokacijo in vsebino načrtovanega treninga', async () => {
    const trener = await prijavljen(app, E_TRENER);
    const novZacetek = cez(72);
    const odgovor = await trener.patch(`/api/treningi/${treningId}`).send(termin({ zacetek: novZacetek, konec: cez(73), lokacija: 'Pomožno igrišče', vsebina: 'Taktika' }));
    expect(odgovor.status).toBe(200);
    expect(odgovor.body).toMatchObject({ zacetek: novZacetek, lokacija: 'Pomožno igrišče', vsebina: 'Taktika', status: 'NACRTOVAN' });

    // Veljajo ista pravila kot pri ustvarjanju.
    const vPreteklost = await trener.patch(`/api/treningi/${treningId}`).send(termin({ zacetek: cez(-5), konec: cez(-4) }));
    expect(vPreteklost.body.polja.zacetek).toBe('Datum in ura začetka ne smeta biti v preteklosti');
  });

  it('AC 2: spremenjen trening ima oznako »Spremenjeno« do začetka treninga', async () => {
    const trener = await prijavljen(app, E_TRENER);
    const igralec = await prijavljen(app, E_IGRALEC);
    expect((await igralec.get('/api/treningi')).body[0].jeSpremenjen).toBe(false);

    // Shranjevanje brez dejanske spremembe oznake ne doda.
    await trener.patch(`/api/treningi/${treningId}`).send(termin({ zacetek: (await igralec.get('/api/treningi')).body[0].zacetek, konec: (await igralec.get('/api/treningi')).body[0].konec }));
    expect((await igralec.get('/api/treningi')).body[0].jeSpremenjen).toBe(false);

    await trener.patch(`/api/treningi/${treningId}`).send(termin({ lokacija: 'Telovadnica' }));
    expect((await igralec.get('/api/treningi')).body[0].jeSpremenjen).toBe(true);

    // Po začetku treninga oznaka ni več prikazana.
    await prisma.trening.update({ where: { id: treningId }, data: { zacetek: new Date(Date.now() - 60_000) } });
    expect((await igralec.get('/api/treningi')).body[0].jeSpremenjen).toBe(false);
  });

  it('AC 3: odpovedan trening ostane v razporedu s statusom »Odpovedan«', async () => {
    const trener = await prijavljen(app, E_TRENER);
    const odgovor = await trener.post(`/api/treningi/${treningId}/odpovej`);
    expect(odgovor.status).toBe(200);
    expect(odgovor.body.status).toBe('ODPOVEDAN');

    const igralec = await prijavljen(app, E_IGRALEC);
    const razpored = await igralec.get('/api/treningi');
    expect(razpored.body).toHaveLength(1);
    expect(razpored.body[0].status).toBe('ODPOVEDAN');
    // Odpovedanega treninga ni več mogoče spreminjati ali ponovno odpovedati.
    expect((await trener.patch(`/api/treningi/${treningId}`).send(termin())).status).toBe(409);
    expect((await trener.post(`/api/treningi/${treningId}/odpovej`)).status).toBe(409);
  });

  it('AC 5: izvedenega treninga ni mogoče odpovedati ali spreminjati', async () => {
    await prisma.trening.update({ where: { id: treningId }, data: { status: 'IZVEDEN' } });
    const trener = await prijavljen(app, E_TRENER);
    const odpoved = await trener.post(`/api/treningi/${treningId}/odpovej`);
    expect(odpoved.status).toBe(409);
    expect(odpoved.body.napaka).toBe('Izvedenega treninga ni mogoče odpovedati');
    expect((await trener.patch(`/api/treningi/${treningId}`).send(termin())).status).toBe(409);
  });

  it('trening lahko spremeni ali odpove samo trener ekipe', async () => {
    for (const ePosta of [E_IGRALEC, E_VODJA]) {
      const o = await prijavljen(app, ePosta);
      expect((await o.patch(`/api/treningi/${treningId}`).send(termin())).status).toBe(403);
      expect((await o.post(`/api/treningi/${treningId}/odpovej`)).status).toBe(403);
    }
  });
});
