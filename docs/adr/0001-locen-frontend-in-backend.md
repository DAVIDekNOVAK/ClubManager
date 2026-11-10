# ADR-0001 – Ločen frontend in backend, povezana prek REST API

- **Status:** sprejeto
- **Datum:** 2026-10-14
- **Nadomešča:** –

## Kontekst in problem

ClubManager ima obsežen uporabniški vmesnik z več vlogami (administrator, trener, igralec, vodja ekipe) in hkrati zahtevno poslovno logiko: preverjanje pravic glede na članstvo v ekipi, validacijo poročil o tekmah in izračun statistike. Odločiti se moramo, ali bosta uporabniški vmesnik in strežniška logika del ene aplikacije ali dveh ločenih delov, ki komunicirata prek API.

## Obravnavane alternative

1. Ločen frontend (React SPA) in backend (REST API z JSON)
2. Strežniško generirane strani v enem projektu (npr. Express s predlogami EJS)
3. Full-stack ogrodje (npr. Next.js), kjer sta vmesnik in API v istem projektu

## Odločitev

Izbrana alternativa: »Ločen frontend in backend«, ker:

- je poslovna logika (pravice, validacije, statistika) zbrana na enem mestu v backendu in je ni mogoče obiti iz brskalnika,
- zasloni, kot sta evidentiranje prisotnosti in poročilo o tekmi, zahtevajo veliko interakcije brez ponovnega nalaganja strani, kar je s SPA bistveno lažje kot s strežniškimi predlogami,
- isti REST API bo lahko kasneje uporabljala tudi mobilna aplikacija, ki je predvidena med nadgradnjami,
- je delitev na dva dela preprostejša za razumevanje in razvoj kot full-stack ogrodje, kjer se meja med odjemalcem in strežnikom zabriše.

## Posledice

### Pozitivne

- Frontend in backend je mogoče razvijati in testirati neodvisno.
- Backend je mogoče testirati prek API brez uporabniškega vmesnika.
- Pripravljena osnova za mobilno aplikacijo.

### Negativne

- Dva projekta, dve konfiguraciji in dva razvojna strežnika.
- Treba je uskladiti obliko podatkov med frontendom in backendom (tipi TypeScript na obeh straneh).
- Potrebna je nastavitev CORS ali posredovanja (proxy) ter pravilno pošiljanje piškotkov med izvoroma.
