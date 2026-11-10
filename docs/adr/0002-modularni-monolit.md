# ADR-0002 – Backend kot modularni monolit

- **Status:** sprejeto
- **Datum:** 2026-10-14
- **Nadomešča:** –

## Kontekst in problem

Backend pokriva več področij: uporabnike in povabila, ekipe in članstva, treninge in prisotnost, tekme in poročila ter statistiko. Ta področja so močno povezana (npr. poročilo o tekmi potrebuje podatke o članstvih in razpoložljivosti, statistika pa podatke o treningih in tekmah). Odločiti se moramo, kako backend notranje organizirati, da bo pregleden in hkrati preprost za razvoj in zagon.

## Obravnavane alternative

1. Modularni monolit – ena aplikacija, razdeljena na module po področjih
2. Mikrostoritve – ločena storitev za vsako področje
3. Klasični monolit brez jasne delitve (razdelitev samo po tehničnih slojih, npr. vse poti v eni mapi)

## Odločitev

Izbrana alternativa: »Modularni monolit«, ker:

- so področja tesno povezana in si delijo isto podatkovno bazo, zato bi jih mikrostoritve umetno ločile in zahtevale komunikacijo med storitvami in porazdeljene transakcije,
- gre za aplikacijo za en manjši klub z majhnim številom hkratnih uporabnikov, zato neodvisno skaliranje posameznih delov ni potrebno,
- delitev na module (uporabniki, ekipe, treningi, tekme, statistika) kljub temu ohrani preglednost kode in jasne meje odgovornosti, česar klasični monolit ne zagotavlja.

## Posledice

### Pozitivne

- En proces, en zagon in ena podatkovna baza – preprost razvoj, razhroščevanje in namestitev.
- Transakcije čez več področij (npr. potrditev poročila in posodobitev statistike) so preproste.
- Moduli lahko v prihodnosti postanejo osnova za ločene storitve, če bi bilo to potrebno.

### Negativne

- Disciplino pri mejah med moduli je treba vzdrževati ročno, sicer se koda začne prepletati.
- Napaka v enem modulu lahko vpliva na celotno aplikacijo.
- Posameznih delov ni mogoče skalirati ali nameščati ločeno.
