# ADR-0007 – Docker Compose za lokalno razvojno okolje

- **Status:** sprejeto
- **Datum:** 2026-10-14
- **Nadomešča:** –

## Kontekst in problem

Za razvoj ClubManagerja je poleg Node.js potreben strežnik PostgreSQL. Projekt se razvija na različnih računalnikih in operacijskih sistemih (macOS, Windows), ocenjevalec pa mora projekt zagnati čim hitreje. Ročna namestitev PostgreSQL vodi do različnih različic in nastavitev na posameznih računalnikih in do napak tipa »pri meni deluje«.

## Obravnavane alternative

1. Docker Compose za PostgreSQL, frontend in backend pa se zaganjata z `npm run dev`
2. Ročna lokalna namestitev PostgreSQL na vsakem računalniku
3. Oblačna podatkovna baza (npr. Neon, Supabase) tudi za razvoj
4. Docker Compose za celotno aplikacijo (baza, backend in frontend v kontejnerjih)

## Odločitev

Izbrana alternativa: »Docker Compose za PostgreSQL«, ker:

- en ukaz (`docker compose up`) na vsakem računalniku zažene enako različico in nastavitve baze, brez ročne namestitve,
- je baza lokalna, zato razvoj deluje brez interneta in brez tveganja, da bi si razvijalci delili ali pokvarili skupne podatke, kar je slabost oblačne baze,
- frontend in backend ostaneta zunaj kontejnerjev, kar ohrani hitro samodejno osveževanje (hot reload) in preprosto razhroščevanje v urejevalniku; zagon celotne aplikacije v kontejnerjih bi to otežil brez pomembne koristi v tej fazi.

## Posledice

### Pozitivne

- Ponovljivo okolje in hiter začetek dela za vsakega razvijalca.
- Bazo je mogoče kadarkoli izbrisati in znova ustvariti.
- Konfiguracija okolja je shranjena v repozitoriju (`docker-compose.yml`).

### Negativne

- Na vsakem računalniku mora biti nameščen in zagnan Docker, ki porabi dodatne vire.
- Node.js in npm je še vedno treba namestiti ročno.
- Razvojno okolje se razlikuje od morebitnega produkcijskega okolja.
