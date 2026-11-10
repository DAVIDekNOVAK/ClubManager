# ADR-0006 – Dinamičen izračun statistike iz evidenc

- **Status:** sprejeto
- **Datum:** 2026-10-14
- **Nadomešča:** –

## Kontekst in problem

Aplikacija prikazuje statistiko igralcev in ekip: nastope, minute, gole, asistence, kartone, zmage, remije, poraze in odstotek prisotnosti po sezonah in ekipah. Vsi ti podatki izhajajo iz evidenc treningov, prisotnosti, nastopov in dogodkov na tekmah. Trener lahko že zaključeno poročilo ali prisotnost kasneje popravi (US-08, US-13), statistika pa mora biti po popravku pravilna. Odločiti se moramo, ali statistiko shranjujemo posebej ali jo izračunamo iz osnovnih podatkov.

## Obravnavane alternative

1. Dinamičen izračun statistike ob vsaki poizvedbi iz osnovnih evidenc
2. Shranjevanje izračunane statistike v posebne tabele, ki se posodabljajo ob vsaki spremembi
3. Periodičen izračun (npr. enkrat na dan) v posebne tabele

## Odločitev

Izbrana alternativa: »Dinamičen izračun«, ker:

- obstaja en sam vir resnice; podatki se ne podvajajo, zato statistika ne more biti v neskladju z evidencami,
- se popravki poročil in prisotnosti v statistiki odrazijo takoj, brez dodatne logike za posodabljanje,
- so pravila za izračun (npr. upoštevajo se samo zaključene tekme, odpovedani treningi se ne štejejo, prisotnost samo v času članstva) na enem mestu v kodi in jih je lažje spremeniti,
- je količina podatkov enega amaterskega kluba (nekaj ekip, nekaj sto tekem in treningov na sezono) dovolj majhna, da so poizvedbe hitre tudi brez predhodnega izračuna,
- bi periodičen izračun prikazoval zastarele podatke, kar je v nasprotju z zahtevo, da so spremembe vidne ob naslednjem odprtju statistike.

## Posledice

### Pozitivne

- Statistika je vedno skladna z osnovnimi podatki.
- Manj tabel in manj kode za sinhronizacijo.
- Preprosto dodajanje novih statističnih kazalnikov brez migracije obstoječih podatkov.

### Negativne

- Poizvedbe za statistiko so kompleksnejše (združevanje več tabel) in počasnejše od branja vnaprej izračunanih vrednosti.
- Pri večjem obsegu podatkov (npr. razširitev na več klubov) bo morda treba uvesti predpomnjenje ali materializirane poglede in to odločitev nadomestiti z novim ADR.
