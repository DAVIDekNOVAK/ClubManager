/**
 * Testni (demo) podatki. Zagon: `npm run db:seed`.
 * Skripta najprej izprazni vse tabele, zato jo je mogoče pognati večkrat.
 * Datumi so izračunani glede na današnji dan, da so v razporedu vedno
 * pretekle in prihajajoče aktivnosti.
 */
import { PrismaClient, type DejanskaPrisotnost, type Uporabnik, type Vloga } from '@prisma/client';
import { zgostiGeslo } from '../src/modules/auth/gesla.js';

const prisma = new PrismaClient();

const DAN = 86_400_000;
const zdaj = new Date();
const danes = new Date(Date.UTC(zdaj.getFullYear(), zdaj.getMonth(), zdaj.getDate()));
const datum = (leto: number, mesec: number, dan: number) => new Date(Date.UTC(leto, mesec - 1, dan));
/** Trenutek čez `dni` dni (negativno = v preteklosti) ob lokalni uri `ura:minute`. */
function termin(dni: number, ura: number, minute = 0): Date {
  const d = new Date(zdaj.getFullYear(), zdaj.getMonth(), zdaj.getDate() + dni, ura, minute, 0, 0);
  return d;
}

const IGRALCI: [string, string][] = [
  ['Luka', 'Zupan'], ['Jan', 'Kovačič'], ['Nejc', 'Potočnik'], ['Žan', 'Mlakar'],
  ['Tim', 'Vidmar'], ['Rok', 'Kos'], ['Matic', 'Golob'], ['Anže', 'Turk'],
  ['Blaž', 'Božič'], ['David', 'Hribar'], ['Gašper', 'Kralj'], ['Miha', 'Korošec'],
  ['Jure', 'Bizjak'], ['Aljaž', 'Kotnik'], ['Domen', 'Kavčič'], ['Urban', 'Rozman'],
];

async function main() {
  const tabele = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE ${tabele.map((t) => `"public"."${t.tablename}"`).join(', ')} RESTART IDENTITY CASCADE`,
  );

  // --- Uporabniki -----------------------------------------------------------
  const uporabnik = async (ime: string, priimek: string, ePosta: string, geslo: string, jeAdministrator = false) =>
    prisma.uporabnik.create({ data: { ime, priimek, ePosta, gesloHash: await zgostiGeslo(geslo), jeAdministrator } });

  await uporabnik('Ana', 'Novak', 'admin@clubmanager.si', 'Admin1234', true);
  const trener = await uporabnik('Marko', 'Kovač', 'trener@clubmanager.si', 'Trener1234');
  const vodja = await uporabnik('Petra', 'Horvat', 'vodja@clubmanager.si', 'Vodja1234');
  const gesloIgralcev = await zgostiGeslo('Igralec1234');
  const igralci: Uporabnik[] = [];
  for (const [i, [ime, priimek]] of IGRALCI.entries()) {
    igralci.push(
      await prisma.uporabnik.create({
        data: { ime, priimek, ePosta: `igralec${i + 1}@clubmanager.si`, gesloHash: gesloIgralcev },
      }),
    );
  }

  // --- Sezone ---------------------------------------------------------------
  // Tekmovalna sezona traja od 1. julija do 30. junija.
  const leto = zdaj.getMonth() >= 6 ? zdaj.getFullYear() : zdaj.getFullYear() - 1;
  const naziv = (l: number) => `${l}/${String(l + 1).slice(2)}`;
  const prejsnja = await prisma.sezona.create({
    data: { naziv: naziv(leto - 1), datumZacetka: datum(leto - 1, 7, 1), datumKonca: datum(leto, 6, 30) },
  });
  const trenutna = await prisma.sezona.create({
    data: { naziv: naziv(leto), datumZacetka: datum(leto, 7, 1), datumKonca: datum(leto + 1, 6, 30) },
  });
  await prisma.sezona.create({
    data: { naziv: naziv(leto + 1), datumZacetka: datum(leto + 1, 7, 1), datumKonca: datum(leto + 2, 6, 30) },
  });

  // --- Ekipe in članstva ----------------------------------------------------
  const clani = await prisma.ekipa.create({ data: { naziv: 'Člani', kategorija: 'CLANI' } });
  const u17 = await prisma.ekipa.create({ data: { naziv: 'U17', kategorija: 'U17' } });
  await prisma.ekipa.create({ data: { naziv: 'Veterani', kategorija: 'DRUGO', jeArhivirana: true } });

  const clan = (uporabnikId: number, ekipaId: number, sezonaId: number, vloge: Vloga[], od: Date) =>
    prisma.clanstvoVEkipi.create({
      data: { uporabnikId, ekipaId, sezonaId, datumPridruzitve: od, vloge: { create: vloge.map((vloga) => ({ vloga })) } },
    });

  for (const sezona of [prejsnja, trenutna]) {
    await clan(trener.id, clani.id, sezona.id, ['TRENER'], sezona.datumZacetka);
    await clan(vodja.id, clani.id, sezona.id, ['VODJA_EKIPE'], sezona.datumZacetka);
    for (const igralec of igralci) await clan(igralec.id, clani.id, sezona.id, ['IGRALEC'], sezona.datumZacetka);
  }
  // Uporabnik z več vlogami: Luka Zupan je igralec članov in hkrati trener ter vodja ekipe U17.
  await clan(igralci[0].id, u17.id, trenutna.id, ['TRENER', 'VODJA_EKIPE'], trenutna.datumZacetka);

  // --- Nasprotni klubi ------------------------------------------------------
  const klubi: { id: number }[] = [];
  for (const [nazivKluba, kraj] of [
    ['NK Triglav', 'Kranj'], ['NK Krka', 'Novo mesto'], ['NK Drava', 'Ptuj'],
    ['NK Bistrica', 'Slovenska Bistrica'], ['NK Brda', 'Dobrovo'], ['NK Jadran', 'Dekani'],
  ]) {
    klubi.push(await prisma.nasprotniKlub.create({ data: { naziv: nazivKluba, kraj } }));
  }

  // --- Treningi -------------------------------------------------------------
  async function trening(sezonaId: number, zacetek: Date, vsebina: string, izveden: boolean, odsotni: number[] = []) {
    const t = await prisma.trening.create({
      data: {
        ekipaId: clani.id,
        sezonaId,
        zacetek,
        konec: new Date(zacetek.getTime() + 90 * 60_000),
        lokacija: 'Glavno igrišče',
        vsebina,
        status: izveden ? 'IZVEDEN' : 'NACRTOVAN',
        ustvarilId: trener.id,
      },
    });
    for (const [i, igralec] of igralci.entries()) {
      const odsoten = odsotni.includes(i);
      let dejanska: DejanskaPrisotnost | null = null;
      if (izveden) dejanska = odsoten ? (i % 2 ? 'NEOPRAVICENO_ODSOTEN' : 'OPRAVICENO_ODSOTEN') : 'PRISOTEN';
      await prisma.prisotnost.create({
        data: {
          treningId: t.id,
          igralecId: igralec.id,
          prijavljenaPrisotnost: izveden ? (odsoten && i % 2 === 0 ? 'NE_PRIDE' : 'PRIDE') : 'NI_ODGOVORA',
          razlogOdsotnosti: izveden && odsoten && i % 2 === 0 ? 'SOLA_SLUZBA' : null,
          dejanskaPrisotnost: dejanska,
        },
      });
    }
    return t;
  }

  // Pretekla sezona: trije izvedeni treningi.
  const lani = (mesec: number, dan: number, ura = 18) => new Date(leto - (mesec >= 7 ? 1 : 0), mesec - 1, dan, ura);
  await trening(prejsnja.id, lani(9, 10), 'Tehnika podaj', true, [3]);
  await trening(prejsnja.id, lani(10, 15), 'Igra na dva dotika', true, [3, 7]);
  await trening(prejsnja.id, lani(3, 12), 'Priprava na spomladanski del', true, [5]);

  // Trenutna sezona: izvedeni, odpovedan in prihajajoči treningi.
  await trening(trenutna.id, termin(-9, 18), 'Kondicijska priprava', true, [2, 9]);
  await trening(trenutna.id, termin(-6, 18), 'Prekinitve in koti', true, [4]);
  await trening(trenutna.id, termin(-2, 18), 'Taktika: visok presing', true, [2, 5, 11]);
  const odpovedan = await trening(trenutna.id, termin(1, 18), 'Regeneracija', false);
  await prisma.trening.update({ where: { id: odpovedan.id }, data: { status: 'ODPOVEDAN' } });
  const prihajajoci = await trening(trenutna.id, termin(2, 18), 'Zaključki napadov', false);
  await trening(trenutna.id, termin(4, 18, 30), 'Priprava na tekmo', false);
  await prisma.trening.update({ where: { id: prihajajoci.id }, data: { spremenjenOb: new Date(), lokacija: 'Pomožno igrišče' } });
  await prisma.prisotnost.updateMany({
    where: { treningId: prihajajoci.id, igralecId: { in: [igralci[0].id, igralci[1].id, igralci[2].id] } },
    data: { prijavljenaPrisotnost: 'PRIDE' },
  });
  await prisma.prisotnost.updateMany({
    where: { treningId: prihajajoci.id, igralecId: igralci[3].id },
    data: { prijavljenaPrisotnost: 'NE_PRIDE', razlogOdsotnosti: 'BOLEZEN', komentar: 'Vročina' },
  });

  // --- Tekme ----------------------------------------------------------------
  interface Gol { strelec: number; minuta: number; asistent?: number }
  async function zakljucenaTekma(
    sezonaId: number, datumInUra: Date, klubId: number, jeDomaca: boolean,
    nasiGoli: Gol[], goliNasprotnika: number, rumeni: [number, number][] = [],
  ) {
    const tekma = await prisma.tekma.create({
      data: {
        ekipaId: clani.id, sezonaId, nasprotniKlubId: klubId, datumInUra, jeDomaca,
        lokacija: jeDomaca ? 'Mestni stadion' : 'Stadion nasprotnika',
        vrstaTekmovanja: 'PRVENSTVO', status: 'ZAKLJUCENA',
        domaciGoli: jeDomaca ? nasiGoli.length : goliNasprotnika,
        gostujociGoli: jeDomaca ? goliNasprotnika : nasiGoli.length,
      },
    });
    // Začetna postava: prvih 11 igralcev; igralec 12 v 60. minuti zamenja igralca 11.
    for (const [i, igralec] of igralci.entries()) {
      if (i > 13) continue;
      const zacetna = i < 11;
      const minute = i === 10 ? 60 : i === 11 ? 30 : zacetna ? 90 : 0;
      await prisma.nastopNaTekmi.create({
        data: { tekmaId: tekma.id, igralecId: igralec.id, zacetnaPostava: zacetna, odigraneMinute: minute },
      });
    }
    await prisma.dogodekNaTekmi.create({
      data: { tekmaId: tekma.id, vrstaDogodka: 'MENJAVA', minuta: 60, igralecId: igralci[10].id, vstopilIgralecId: igralci[11].id },
    });
    for (const g of nasiGoli) {
      const gol = await prisma.dogodekNaTekmi.create({
        data: { tekmaId: tekma.id, vrstaDogodka: 'GOL', minuta: g.minuta, igralecId: igralci[g.strelec].id },
      });
      if (g.asistent !== undefined) {
        await prisma.dogodekNaTekmi.create({
          data: { tekmaId: tekma.id, vrstaDogodka: 'ASISTENCA', minuta: g.minuta, igralecId: igralci[g.asistent].id, golId: gol.id },
        });
      }
    }
    for (const [igralec, minuta] of rumeni) {
      await prisma.dogodekNaTekmi.create({
        data: { tekmaId: tekma.id, vrstaDogodka: 'RUMENI_KARTON', minuta, igralecId: igralci[igralec].id },
      });
    }
    return tekma;
  }

  // Pretekla sezona.
  await zakljucenaTekma(prejsnja.id, lani(9, 20, 16), klubi[0].id, true, [{ strelec: 8, minuta: 12, asistent: 6 }, { strelec: 9, minuta: 70 }], 1, [[3, 40]]);
  await zakljucenaTekma(prejsnja.id, lani(10, 4, 16), klubi[1].id, false, [{ strelec: 8, minuta: 55 }], 1);
  await zakljucenaTekma(prejsnja.id, lani(4, 11, 17), klubi[2].id, true, [], 2, [[5, 30], [2, 88]]);

  // Trenutna sezona.
  await zakljucenaTekma(trenutna.id, termin(-21, 16), klubi[3].id, true,
    [{ strelec: 8, minuta: 23, asistent: 7 }, { strelec: 9, minuta: 51, asistent: 8 }, { strelec: 6, minuta: 84 }], 1, [[4, 66]]);
  await zakljucenaTekma(trenutna.id, termin(-14, 15), klubi[4].id, false, [{ strelec: 9, minuta: 38, asistent: 6 }], 1, [[1, 75]]);
  // Odigrana tekma brez poročila – trener ga lahko vnese.
  await prisma.tekma.create({
    data: {
      ekipaId: clani.id, sezonaId: trenutna.id, nasprotniKlubId: klubi[5].id, datumInUra: termin(-3, 16),
      jeDomaca: true, lokacija: 'Mestni stadion', vrstaTekmovanja: 'POKAL',
    },
  });
  // Prihajajoči tekmi.
  await prisma.tekma.create({
    data: {
      ekipaId: clani.id, sezonaId: trenutna.id, nasprotniKlubId: klubi[0].id, datumInUra: termin(5, 16),
      jeDomaca: false, lokacija: 'Športni park Kranj', vrstaTekmovanja: 'PRVENSTVO',
    },
  });
  await prisma.tekma.create({
    data: {
      ekipaId: clani.id, sezonaId: trenutna.id, nasprotniKlubId: klubi[1].id, datumInUra: termin(12, 17),
      jeDomaca: true, lokacija: 'Mestni stadion', vrstaTekmovanja: 'PRIJATELJSKA',
    },
  });

  // --- Razpoložljivost ------------------------------------------------------
  await prisma.razpolozljivostIgralca.create({
    data: { igralecId: igralci[2].id, status: 'POSKODOVAN', veljaOd: new Date(danes.getTime() - 5 * DAN), veljaDo: new Date(danes.getTime() + 9 * DAN) },
  });
  await prisma.razpolozljivostIgralca.create({
    data: { igralecId: igralci[5].id, status: 'OMEJENO_TRENIRANJE', veljaOd: new Date(danes.getTime() - 2 * DAN) },
  });
  await prisma.razpolozljivostIgralca.create({
    data: { igralecId: igralci[9].id, status: 'ODSOTEN', veljaOd: new Date(danes.getTime() + 4 * DAN), veljaDo: new Date(danes.getTime() + 6 * DAN) },
  });

  console.log('Testni podatki so pripravljeni.');
  console.log('  administrator: admin@clubmanager.si / Admin1234');
  console.log('  trener:        trener@clubmanager.si / Trener1234');
  console.log('  vodja ekipe:   vodja@clubmanager.si / Vodja1234');
  console.log('  igralci:       igralec1@clubmanager.si … igralec16@clubmanager.si / Igralec1234');
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
