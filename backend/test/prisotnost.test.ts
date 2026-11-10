import { beforeEach, describe, expect, it } from 'vitest';
import { ustvariAplikacijo } from '../src/app.js';
import { dan, dodajDni } from '../src/common/datumi.js';
import { prisma } from '../src/common/prisma.js';
import { E_ADMIN, E_IGRALEC, E_TRENER, E_VODJA, pocistiBazo, prijavljen, ustvariKlub } from './pomoc.js';

const app = ustvariAplikacijo();
const cez = (ur: number) => new Date(Date.now() + ur * 3_600_000).toISOString();

describe('US-08 – evidentiranje dejanske prisotnosti', () => {
  let klub: Awaited<ReturnType<typeof ustvariKlub>>;
  let treningId: number;
  let pot: string;
  const zacniTrening = () => prisma.trening.update({ where: { id: treningId }, data: { zacetek: new Date(Date.now() - 60_000) } });
  const vsi = (vrednost: string, prepis: Record<number, string> = {}) => ({
    prisotnosti: klub.igralci.map((i) => ({ igralecId: i.id, dejanskaPrisotnost: prepis[i.id] ?? vrednost })),
  });

  beforeEach(async () => {
    await pocistiBazo();
    klub = await ustvariKlub(4);
    const trener = await prijavljen(app, E_TRENER);
    treningId = (await trener.post('/api/treningi').send({ ekipaId: klub.ekipa.id, zacetek: cez(2), konec: cez(3.5), lokacija: 'Igrišče' })).body.id;
    pot = `/api/treningi/${treningId}/prisotnost`;
    // Igralec 1 pride, igralec 2 ne pride, ostala nista odgovorila.
    await prisma.prisotnost.updateMany({ where: { treningId, igralecId: klub.igralci[0].id }, data: { prijavljenaPrisotnost: 'PRIDE' } });
    await prisma.prisotnost.updateMany({ where: { treningId, igralecId: klub.igralci[1].id }, data: { prijavljenaPrisotnost: 'NE_PRIDE', razlogOdsotnosti: 'BOLEZEN' } });
  });

  it('AC 1: zaslon prikaže igralce z veljavnim članstvom na dan treninga, predizpolnjene glede na prijavo', async () => {
    // Igralec 4 je odšel iz ekipe pred treningom, zato ga ni na seznamu.
    await prisma.clanstvoVEkipi.updateMany({ where: { uporabnikId: klub.igralci[3].id }, data: { datumOdhoda: dodajDni(dan(), -1) } });
    const trener = await prijavljen(app, E_TRENER);
    const odgovor = await trener.get(pot);
    expect(odgovor.status).toBe(200);
    expect(odgovor.body.igralci.map((i: { igralecId: number; prijavljenaPrisotnost: string; predlog: string | null; dejanskaPrisotnost: string | null }) => [i.igralecId, i.prijavljenaPrisotnost, i.predlog, i.dejanskaPrisotnost])).toEqual([
      [klub.igralci[0].id, 'PRIDE', 'PRISOTEN', null],
      [klub.igralci[1].id, 'NE_PRIDE', 'OPRAVICENO_ODSOTEN', null],
      [klub.igralci[2].id, 'NI_ODGOVORA', null, null],
    ]);
    expect(odgovor.body.trening.povzetek).toMatchObject({ pride: 1, nePride: 1 });
    expect(odgovor.body.zgodovina).toEqual([]);
  });

  it('AC 2: za vsakega igralca je mogoče izbrati eno od treh vrednosti; manjkajoč igralec je napaka', async () => {
    await zacniTrening();
    const trener = await prijavljen(app, E_TRENER);
    expect((await trener.put(pot).send(vsi('ZAMUDIL'))).status).toBe(400);
    const nepopolno = await trener.put(pot).send({ prisotnosti: [{ igralecId: klub.igralci[0].id, dejanskaPrisotnost: 'PRISOTEN' }] });
    expect(nepopolno.status).toBe(400);
    expect(nepopolno.body.napaka).toBe('Izberite prisotnost za vse igralce');
    const tuj = await trener.put(pot).send({ prisotnosti: [...vsi('PRISOTEN').prisotnosti, { igralecId: klub.trener.id, dejanskaPrisotnost: 'PRISOTEN' }] });
    expect(tuj.status).toBe(400);

    const ok = await trener.put(pot).send(vsi('PRISOTEN', { [klub.igralci[1].id]: 'OPRAVICENO_ODSOTEN', [klub.igralci[2].id]: 'NEOPRAVICENO_ODSOTEN' }));
    expect(ok.status).toBe(200);
    const shranjeno = await prisma.prisotnost.findMany({ where: { treningId }, orderBy: { igralecId: 'asc' } });
    expect(shranjeno.map((p) => p.dejanskaPrisotnost)).toEqual(['PRISOTEN', 'OPRAVICENO_ODSOTEN', 'NEOPRAVICENO_ODSOTEN', 'PRISOTEN']);
  });

  it('AC 3: shranjevanje je mogoče šele po začetku treninga; nato je trening »Izveden«', async () => {
    const trener = await prijavljen(app, E_TRENER);
    const prezgodaj = await trener.put(pot).send(vsi('PRISOTEN'));
    expect(prezgodaj.status).toBe(409);
    expect(prezgodaj.body.napaka).toBe('Evidenco je mogoče shraniti šele po začetku treninga');
    expect((await prisma.trening.findUniqueOrThrow({ where: { id: treningId } })).status).toBe('NACRTOVAN');

    await zacniTrening();
    expect((await trener.put(pot).send(vsi('PRISOTEN'))).status).toBe(200);
    expect((await prisma.trening.findUniqueOrThrow({ where: { id: treningId } })).status).toBe('IZVEDEN');
    // Prvo shranjevanje ni popravek, zato zgodovine še ni.
    expect(await prisma.zgodovinaPrisotnosti.count()).toBe(0);
  });

  it('AC 4: kasnejša sprememba se zabeleži v zgodovini (kdo, kdaj, stara in nova vrednost)', async () => {
    await zacniTrening();
    const trener = await prijavljen(app, E_TRENER);
    await trener.put(pot).send(vsi('PRISOTEN'));
    await trener.put(pot).send(vsi('PRISOTEN', { [klub.igralci[2].id]: 'NEOPRAVICENO_ODSOTEN' }));

    const { zgodovina, igralci } = (await trener.get(pot)).body;
    expect(zgodovina).toHaveLength(1);
    expect(zgodovina[0]).toMatchObject({
      staraVrednost: 'PRISOTEN',
      novaVrednost: 'NEOPRAVICENO_ODSOTEN',
      spremenil: { ime: 'Tine', priimek: 'Trener' },
      igralec: { ime: 'Igralec3' },
    });
    expect(Date.now() - new Date(zgodovina[0].datumSpremembe).getTime()).toBeLessThan(10_000);
    expect(igralci[2].dejanskaPrisotnost).toBe('NEOPRAVICENO_ODSOTEN');
  });

  it('prisotnost evidentira samo trener ekipe; administrator jo lahko pregleda', async () => {
    await zacniTrening();
    for (const ePosta of [E_IGRALEC, E_VODJA]) {
      const o = await prijavljen(app, ePosta);
      expect((await o.get(pot)).status).toBe(403);
      expect((await o.put(pot).send(vsi('PRISOTEN'))).status).toBe(403);
    }
    const admin = await prijavljen(app, E_ADMIN);
    expect((await admin.get(pot)).status).toBe(200);
    expect((await admin.put(pot).send(vsi('PRISOTEN'))).status).toBe(403);
  });
});
