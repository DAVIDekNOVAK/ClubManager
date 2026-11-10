import { beforeEach, describe, expect, it } from 'vitest';
import { ustvariAplikacijo } from '../src/app.js';
import { dan, dodajDni } from '../src/common/datumi.js';
import { prisma } from '../src/common/prisma.js';
import { E_ADMIN, E_IGRALEC, E_TRENER, E_VODJA, pocistiBazo, prijavljen, ustvariKlub } from './pomoc.js';

const app = ustvariAplikacijo();

describe('US-17 – pregled razpoložljivosti pred tekmo', () => {
  let klub: Awaited<ReturnType<typeof ustvariKlub>>;
  let pot: string;
  const DNI_DO_TEKME = 5;

  beforeEach(async () => {
    await pocistiBazo();
    klub = await ustvariKlub(5);
    const nasprotnik = await prisma.nasprotniKlub.create({ data: { naziv: 'NK Triglav', kraj: 'Kranj' } });
    const datumInUra = new Date(dodajDni(dan(), DNI_DO_TEKME).getTime() + 15 * 3_600_000);
    const tekma = await prisma.tekma.create({
      data: { ekipaId: klub.ekipa.id, sezonaId: klub.sezona.id, nasprotniKlubId: nasprotnik.id, datumInUra, jeDomaca: true, lokacija: 'Stadion', vrstaTekmovanja: 'PRVENSTVO' },
    });
    pot = `/api/tekme/${tekma.id}/razpolozljivost`;
    const d = (dni: number) => dodajDni(dan(), dni);
    const [i1, i2, i3, i4] = klub.igralci;
    await prisma.razpolozljivostIgralca.createMany({
      data: [
        // Poškodovan do dneva pred tekmo → na dan tekme »Na voljo« (AC 2).
        { igralecId: i1.id, status: 'POSKODOVAN', veljaOd: d(-3), veljaDo: d(DNI_DO_TEKME - 1) },
        // Poškodovan tudi na dan tekme.
        { igralecId: i2.id, status: 'POSKODOVAN', veljaOd: d(-3), veljaDo: d(DNI_DO_TEKME) },
        // Danes na voljo, odsoten pa prav na dan tekme.
        { igralecId: i3.id, status: 'ODSOTEN', veljaOd: d(DNI_DO_TEKME), veljaDo: d(DNI_DO_TEKME + 2) },
        { igralecId: i4.id, status: 'OMEJENO_TRENIRANJE', veljaOd: d(0) },
      ],
    });
  });

  it('AC 1 in AC 2: seznam igralcev s statusom, izračunanim za datum tekme', async () => {
    const trener = await prijavljen(app, E_TRENER);
    const odgovor = await trener.get(pot);
    expect(odgovor.status).toBe(200);
    expect(odgovor.body.igralci.map((i: { ime: string; status: string }) => [i.ime, i.status])).toEqual([
      ['Igralec1', 'NA_VOLJO'],
      ['Igralec2', 'POSKODOVAN'],
      ['Igralec3', 'ODSOTEN'],
      ['Igralec4', 'OMEJENO_TRENIRANJE'],
      ['Igralec5', 'NA_VOLJO'],
    ]);
    // Današnji pregled ekipe je drugačen: igralec 1 je danes še poškodovan, igralec 3 pa na voljo.
    const danes = await trener.get(`/api/ekipe/${klub.ekipa.id}/razpolozljivost`);
    expect(danes.body.igralci.slice(0, 3).map((i: { status: string }) => i.status)).toEqual(['POSKODOVAN', 'POSKODOVAN', 'NA_VOLJO']);
  });

  it('AC 3: povzetek s številom igralcev po posameznem statusu', async () => {
    const trener = await prijavljen(app, E_TRENER);
    expect((await trener.get(pot)).body.povzetek).toEqual({ NA_VOLJO: 2, OMEJENO_TRENIRANJE: 1, POSKODOVAN: 1, ODSOTEN: 1 });
  });

  it('pregled vidita trener ekipe in administrator', async () => {
    expect((await (await prijavljen(app, E_ADMIN)).get(pot)).status).toBe(200);
    expect((await (await prijavljen(app, E_IGRALEC)).get(pot)).status).toBe(403);
    expect((await (await prijavljen(app, E_VODJA)).get(pot)).status).toBe(403);
  });
});
