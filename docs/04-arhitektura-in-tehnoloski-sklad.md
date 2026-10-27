# 04 – Arhitektura in tehnološki sklad

## 1. Arhitektura rešitve

ClubManager bo zasnovan kot spletna aplikacija s tridelno arhitekturo, ki vključuje frontend, backend in podatkovno bazo.

- Frontend: uporabniški vmesnik za igralce, trenerje, vodje ekip in administratorje.
- Backend: REST API za obdelavo zahtevkov, poslovno logiko, avtentikacijo in preverjanje pravic.
- Podatkovna baza: shranjevanje uporabnikov, ekip, sezon, treningov, tekem, prisotnosti in statističnih podatkov.

Frontend bo z backendom komuniciral prek HTTP-zahtev v formatu JSON. Backend bo do podatkovne baze dostopal prek ORM-orodja Prisma.



### Avtentikacija in uporabniške pravice

Uporabniki se bodo registrirali prek povabila administratorja. Prijava bo potekala z e-poštnim naslovom in geslom.

Za avtentikacijo bodo uporabljene strežniške seje in varni HttpOnly piškotki. Gesla bodo shranjena kot zgoščene vrednosti z algoritmom Argon2id.

Dostop do funkcionalnosti bo omejen glede na uporabniške vloge (RBAC) in članstvo v posamezni ekipi. Backend bo preverjal pravice pri vsaki zaščiteni zahtevi.

### Lokalni zagon

Za lokalni razvoj bodo uporabljeni Node.js, npm in Docker Compose.

1. Docker Compose zažene PostgreSQL.
2. Backend se zažene z `npm run dev`.
3. Frontend se zažene z `npm run dev`.
4. Aplikacija je dostopna prek lokalnega spletnega brskalnika.

Nastavitve povezave s podatkovno bazo bodo shranjene v datoteki `.env`.

## 2. Tehnološki sklad

| Področje | Tehnologija |
|---|---|
| Frontend | React, TypeScript, Vite |
| Backend | Node.js, Express, TypeScript |
| API | REST, JSON |
| Podatkovna baza | PostgreSQL |
| ORM | Prisma |
| Avtentikacija | express-session, Argon2id |
| Avtorizacija | RBAC in preverjanje članstva |
| Lokalni razvoj | Docker Compose, npm |
| Razvojno okolje | Visual Studio Code |
| Verzijski nadzor | Git, GitHub |

## 3. Arhitekturne odločitve

- Ločen frontend in backend: omogočata neodvisen razvoj uporabniškega vmesnika in poslovne logike.
- Modularni monolit: backend bo razdeljen na module (uporabniki, ekipe, treningi, tekme, statistika), kar poenostavi razvoj in vzdrževanje.
- PostgreSQL: relacijska podatkovna baza je primerna zaradi številnih povezav med igralci, ekipami in sezonami.
- Prisma ORM: poenostavi delo s podatkovno bazo, povezavami in migracijami.
- Strežniške seje: omogočajo nadzor prijav in odjav brez shranjevanja JWT-žetonov v brskalniku. Uporabljena bo tudi zaščita pred CSRF.
- Dinamična statistika: statistični podatki se bodo izračunavali iz evidenc treningov in tekem, kar preprečuje podvajanje podatkov.
- Docker Compose: zagotavlja ponovljivo lokalno razvojno okolje.