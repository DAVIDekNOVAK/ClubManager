# 01 – Zasnova rešitve

## 1. Ime rešitve

ClubManager – spletna aplikacija za upravljanje nogometnega kluba

## 2. Namen rešitve in problem

ClubManager je spletna aplikacija, namenjena organizaciji in upravljanju nogometnih klubov, ki imajo več ekip različnih starostnih kategorij (npr. člani, U19, U17, U15).

V manjših in amaterskih nogometnih klubih se podatki o igralcih, treningih, tekmah in prisotnosti pogosto vodijo ločeno, na primer v Excelovih preglednicah, sporočilnih aplikacijah ali papirnih evidencah (ali se pa sploh nebeležijo). Takšen način dela otežuje organizacijo aktivnosti, spremljanje razpoložljivosti igralcev in pregledovanje statistike skozi več tekmovalnih sezon.

Namen rešitve je združiti ključne organizacijske in športne podatke kluba v enoten informacijski sistem ter zmanjšati potrebo po ročnem vodenju evidenc.

Aplikacija bo omogočala upravljanje ekip in članstev, načrtovanje treningov in tekem, spremljanje razpoložljivosti igralcev, evidentiranje prisotnosti ter beleženje rezultatov in dogodkov tekem. Na podlagi shranjenih podatkov bo sistem samodejno izračunaval statistiko igralcev in ekip.

## 3. Ciljni uporabniki

Rešitev je namenjena predvsem manjšim in amaterskim nogometnim klubom, ki želijo digitalizirati organizacijo svojih ekip.

Sistem predvideva štiri uporabniške vloge:

- Administrator kluba: upravlja ekipe, tekmovalne sezone, uporabniške račune, članstva in dodeljevanje uporabniških vlog.
- Trener: načrtuje treninge, evidentira prisotnost, pripravlja poročila o tekmah in spremlja statistiko igralcev svojih ekip.
- Igralec: pregleduje razpored aktivnosti, potrjuje udeležbo, posodablja svojo razpoložljivost ter spremlja osebno statistiko skozi različne sezone.
- Vodja ekipe: skrbi za organizacijski del ekipe, predvsem razpored tekem, podatke o nasprotnikih in organizacijo klubskih aktivnosti.

Posamezen uporabnik lahko opravlja več vlog, odvisno od ekipe. Na primer, uporabnik je lahko igralec članske ekipe in hkrati trener mladinske ekipe.

## 4. Kratek opis delovanja rešitve

ClubManager bo deloval kot spletna aplikacija, dostopna prek spletnega brskalnika. Uporabniki se bodo v sistem vključili na podlagi povabila administratorja, nato pa se prijavili s svojim uporabniškim računom.

Administrator bo v sistemu ustvarjal in upravljal ekipe ter tekmovalne sezone. Posamezen igralec bo lahko v isti sezoni član več ekip, podatki preteklih sezon pa bodo ostali shranjeni.

Organizacija treningov: Trener ustvari trening in določi datum, uro ter lokacijo. Igralci lahko potrdijo svojo udeležbo ali prijavijo odsotnost. Po izvedenem treningu trener skupinsko evidentira dejansko prisotnost igralcev. Sistem te podatke uporabi za izračun statistike prisotnosti.

Organizacija tekem: Vodja ekipe vnese podatke o prihajajoči tekmi in izbere nasprotni klub iz evidence. Po zaključeni tekmi trener pripravi poročilo, v katerem zabeleži rezultat, začetno postavo, menjave, igralne minute, gole, asistence in kartone. Na podlagi teh dogodkov aplikacija izračuna statistiko igralcev in ekipe.

Razpoložljivost igralcev: Igralci lahko posodabljajo svoj status razpoložljivosti (na voljo, odsoten, poškodovan ali omejeno treniranje). Sistem hrani zgodovino statusov, trenerjem pa omogoča pregled razpoložljivosti igralcev njihovih ekip.

Statistika in zgodovina: Aplikacija omogoča pregled statistike po igralcih, ekipah in tekmovalnih sezonah. Statistični podatki se izračunavajo neposredno iz evidenc treningov in tekem. Igralci lahko spremljajo svojo celotno športno zgodovino, tudi iz preteklih ekip.

Dostop do podatkov bo omejen glede na uporabniško vlogo in pripadnost ekipi. Administrator bo imel pregled nad celotnim klubom, drugi uporabniki pa bodo dostopali do podatkov svojih ekip in lastne športne zgodovine.

Rešitev bo zasnovana tako, da bo omogočala nadaljnje nadgradnje, kot so podrobnejša evidenca poškodb, rehabilitacija, organizacija prevozov in napredna športna analitika.

## 5. Ključni delovni proces

Osrednji delovni proces rešitve je vodenje tekme od načrtovanja do statistike. V procesu sodelujejo različne uporabniške vloge, tekma pa med izvajanjem prehaja med več statusi.

1. Načrtovanje tekme (vodja ekipe): vodja ekipe ustvari tekmo, izbere nasprotni klub, datum in lokacijo. Tekma dobi status načrtovana.
2. Preverjanje razpoložljivosti (trener): trener pred tekmo pregleda razpoložljivost igralcev ekipe. Igralci, ki so poškodovani ali odsotni, so v pregledu ustrezno označeni.
3. Izvedba tekme: po odigrani tekmi se status spremeni v odigrana.
4. Priprava poročila (trener): trener vnese rezultat, začetno postavo, menjave, igralne minute, gole, asistence in kartone. Sistem preveri, da so v poročilu samo igralci z veljavnim članstvom v ekipi.
5. Zaključek poročila: trener potrdi poročilo, tekma dobi status zaključena. Podatki tekme se vključijo v statistiko igralcev in ekipe.
6. Popravki: če trener kasneje popravi poročilo, sistem spremembo zabeleži v zgodovini sprememb tekme (kdo, kdaj in kaj je spremenil), statistika pa se ponovno izračuna.

Podoben proces poteka pri treningih: trener načrtuje trening, igralci potrdijo udeležbo ali prijavijo odsotnost, po treningu trener evidentira dejansko prisotnost, popravki pa se beležijo v zgodovini sprememb prisotnosti.
