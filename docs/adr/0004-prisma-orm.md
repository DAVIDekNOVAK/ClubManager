# ADR-0004 – Dostop do podatkovne baze prek ORM Prisma

- **Status:** sprejeto
- **Datum:** 2026-10-14
- **Nadomešča:** –

## Kontekst in problem

Backend v TypeScriptu mora dostopati do baze PostgreSQL s 16 povezanimi entitetami. Shema se bo med razvojem pogosto spreminjala, zato potrebujemo zanesljive migracije. Želimo tudi, da prevajalnik TypeScript zazna napake pri delu s podatki (napačno ime polja, napačen tip), preden pridejo v produkcijo.

## Obravnavane alternative

1. Prisma
2. TypeORM
3. Sequelize
4. Čisti SQL (npr. knjižnica `pg`) brez ORM

## Odločitev

Izbrana alternativa: »Prisma«, ker:

- se iz ene datoteke s shemo samodejno generirajo tipi TypeScript, zato prevajalnik zazna napake pri poizvedbah; pri Sequelize in čistem SQL te varnosti ni, pri TypeORM pa je tipizacija rezultatov poizvedb šibkejša,
- shema v enem mestu služi hkrati kot dokumentacija podatkovnega modela in vir za migracije (`prisma migrate`),
- je delo s povezavami (npr. članstva z vlogami, tekma z nastopi in dogodki) preprosto in pregledno,
- čisti SQL bi pri tem obsegu modela pomenil veliko ponavljajoče se kode in ročno vzdrževanje migracij.

## Posledice

### Pozitivne

- Tipsko varne poizvedbe in samodokončevanje v urejevalniku.
- Preproste in sledljive migracije, shranjene v repozitoriju.
- Prisma Studio za hiter pregled podatkov med razvojem.

### Negativne

- Zelo zahtevne poizvedbe (npr. nekatere statistike) bo morda treba napisati v čistem SQL (`$queryRaw`).
- Dodatna odvisnost in korak generiranja odjemalca po vsaki spremembi sheme.
- Manjši nadzor nad tem, kakšen SQL se dejansko izvede.
