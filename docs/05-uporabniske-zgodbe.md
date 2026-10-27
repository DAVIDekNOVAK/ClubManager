# 05 – Uporabniške zgodbe

## INVEST

Uporabniške zgodbe so napisane po kriterijih INVEST:

- I – Independent (neodvisna) – Zgodbo je mogoče razviti in predstaviti ločeno od drugih zgodb.
- N – Negotiable (dogovorljiva) – Zgodba opisuje cilj uporabnika, ne natančne tehnične izvedbe, zato se podrobnosti lahko dogovorijo med razvojem.
- V – Valuable (vredna) – Zgodba prinaša konkretno korist uporabniku, kar opisuje del »da …«.
- E – Estimable (ocenljiva) – Obseg zgodbe je dovolj jasen, da je mogoče oceniti potreben čas za razvoj.
- S – Small (majhna) – Zgodba je dovolj majhna, da jo je mogoče izvesti v eni iteraciji. Večje funkcionalnosti so razdeljene na več zgodb.
- T – Testable (preverljiva) – Za zgodbo obstajajo acceptance criteria, s katerimi je mogoče preveriti, ali je izvedena pravilno.

### F1 – Upravljanje ekip in članstev

#### US-01 – Ustvarjanje sezone

| Oznaka | Povezana funkcionalnost | Uporabniška vloga |
|---|---|---|
| US-01 | F1 – Upravljanje ekip in članstev (MVP) | Administrator kluba |

Uporabniška zgodba:
Kot administrator kluba želim ustvariti tekmovalno sezono z nazivom ter datumom začetka in konca, da lahko članstva, treninge in tekme povežem s pravo sezono.

Acceptance criteria:

1. Obvezna polja so naziv (npr. »2026/27«), datum začetka in datum konca. Datum konca mora biti kasnejši od datuma začetka, sicer se ob polju prikaže napaka.
2. Obdobje nove sezone se ne sme prekrivati z obstoječo sezono. V tem primeru se prikaže sporočilo »Obdobje se prekriva s sezono [naziv]«.
3. Nova sezona dobi status »Načrtovana«. Ko nastopi datum začetka, samodejno dobi status »Aktivna«, po datumu konca pa »Zaključena«.
4. Članstva, treningi, tekme in statistika zaključene sezone ostanejo shranjeni in so na voljo pri izbiri sezone v statistiki.
5. Sezono lahko ustvari samo administrator. Zahteva drugega uporabnika vrne odgovor 403.

---

#### US-02 – Ustvarjanje ekipe

| Oznaka | Povezana funkcionalnost | Uporabniška vloga |
|---|---|---|
| US-02 | F1 – Upravljanje ekip in članstev (MVP) | Administrator kluba |

Uporabniška zgodba:
Kot administrator kluba želim ustvariti novo ekipo z nazivom in starostno kategorijo, da lahko vanjo razporedim igralce in trenerje.

Acceptance criteria:

1. Obrazec za novo ekipo zahteva naziv (2–50 znakov) in kategorijo, izbrano s seznama (Člani, U19, U17, U15, U13, Drugo). Če obvezno polje ni izpolnjeno, se ob njem prikaže napaka in ekipa se ne shrani.
2. Naziv ekipe mora biti unikaten med nearhiviranimi ekipami. Ob podvojenem nazivu se prikaže sporočilo »Ekipa s tem nazivom že obstaja«.
3. Po uspešnem shranjevanju se nova ekipa prikaže na seznamu ekip s statusom »Aktivna« in brez članov.
4. Gumb »Nova ekipa« je prikazan samo administratorju. Zahteva za ustvarjanje ekipe s strani drugega uporabnika vrne odgovor 403 (prepovedano).

---

#### US-03 – Dodajanje člana v ekipo

| Oznaka | Povezana funkcionalnost | Uporabniška vloga |
|---|---|---|
| US-03 | F1 – Upravljanje ekip in članstev (MVP) | Administrator kluba |

Uporabniška zgodba:
Kot administrator kluba želim dodati uporabnika v ekipo za izbrano sezono in mu določiti vlogo, da ima dostop do aktivnosti in podatkov te ekipe.

Acceptance criteria:

1. Administrator izbere uporabnika, ekipo, sezono, eno ali več vlog (igralec, trener, vodja ekipe) in datum pridružitve. Vsa ta polja so obvezna.
2. Istega uporabnika ni mogoče dvakrat dodati v isto ekipo in sezono. V tem primeru se prikaže sporočilo »Uporabnik je že član te ekipe v izbrani sezoni«.
3. Uporabnik je lahko v isti sezoni član več ekip z različnimi vlogami. Na njegovem profilu so prikazana vsa njegova članstva.
4. Ko administrator vnese datum odhoda, se članstvo ne izbriše. Uporabnik po tem datumu ne vidi več prihodnjih aktivnosti ekipe, njegovi pretekli podatki pa ostanejo v statistiki.
5. Po dodajanju uporabnik ob naslednjem nalaganju strani vidi novo ekipo v svojem seznamu ekip.

---

#### US-04 – Arhiviranje ekipe

| Oznaka | Povezana funkcionalnost | Uporabniška vloga |
|---|---|---|
| US-04 | F1 – Upravljanje ekip in članstev (MVP) | Administrator kluba |

Uporabniška zgodba:
Kot administrator kluba želim arhivirati ekipo, ki ne nastopa več, da seznam aktivnih ekip ostane pregleden, zgodovinski podatki pa se ohranijo.

Acceptance criteria:

1. Pred arhiviranjem se odpre potrditveno okno »Ali res želite arhivirati ekipo [naziv]?«. Ekipa se arhivira šele po potrditvi.
2. Arhivirana ekipa se ne prikazuje na privzetem seznamu ekip, vidna pa je ob izbiri filtra »Arhivirane«.
3. Za arhivirano ekipo ni mogoče ustvariti novih treningov ali tekem, zato gumba za njihovo ustvarjanje nista prikazana.
4. Vsi treningi, tekme, evidence prisotnosti in statistika arhivirane ekipe ostanejo shranjeni in vidni v statistiki igralcev.
5. Administrator lahko arhivirano ekipo z gumbom »Ponovno aktiviraj« vrne med aktivne ekipe.

---

### F2 – Načrtovanje treningov

#### US-05 – Ustvarjanje treninga

| Oznaka | Povezana funkcionalnost | Uporabniška vloga |
|---|---|---|
| US-05 | F2 – Načrtovanje treningov (MVP) | Trener |

Uporabniška zgodba:
Kot trener želim ustvariti trening z datumom, uro, lokacijo in vsebino, da igralci pravočasno vedo, kdaj in kje bo trening.

Acceptance criteria:

1. Obvezna polja so datum, ura začetka, ura konca in lokacija. Polje »Vsebina treninga« je neobvezno in omejeno na 500 znakov.
2. Datum in ura začetka ne smeta biti v preteklosti, ura konca pa mora biti kasneje od ure začetka. V nasprotnem primeru se prikaže napaka ob polju.
3. Po shranjevanju se trening s statusom »Načrtovan« prikaže v razporedu vseh igralcev z veljavnim članstvom v ekipi.
4. Za vsakega igralca ekipe se ustvari evidenca prisotnosti s prijavljeno prisotnostjo »Ni odgovora«.
5. Trener lahko ustvari trening samo za ekipe, v katerih ima vlogo trenerja. Druge ekipe se v izbirnem seznamu ne prikažejo.

---

#### US-06 – Sprememba in odpoved treninga

| Oznaka | Povezana funkcionalnost | Uporabniška vloga |
|---|---|---|
| US-06 | F2 – Načrtovanje treningov (MVP) | Trener |

Uporabniška zgodba:
Kot trener želim spremeniti ali odpovedati načrtovan trening, da imajo igralci vedno pravilne informacije o terminu.

Acceptance criteria:

1. Trener lahko spremeni datum, uro, lokacijo in vsebino treninga, dokler ima trening status »Načrtovan«.
2. Spremenjen trening je v razporedu igralcev označen z oznako »Spremenjeno«, ki ostane vidna do začetka treninga.
3. Ob odpovedi trening dobi status »Odpovedan«, v razporedu ostane prikazan prečrtano, igralci pa pri njem ne morejo več potrjevati udeležbe.
4. Odpovedani treningi se ne upoštevajo pri izračunu odstotka prisotnosti.
5. Treninga s statusom »Izveden« (z že evidentirano prisotnostjo) ni mogoče odpovedati. Gumb »Odpovej« pri njem ni prikazan.

---

### F3 – Evidentiranje prisotnosti

#### US-07 – Potrjevanje udeležbe na treningu

| Oznaka | Povezana funkcionalnost | Uporabniška vloga |
|---|---|---|
| US-07 | F3 – Evidentiranje prisotnosti (MVP) | Igralec |

Uporabniška zgodba:
Kot igralec želim pri prihajajočem treningu potrditi udeležbo ali prijaviti odsotnost, da trener ve, koliko igralcev lahko pričakuje.

Acceptance criteria:

1. Pri vsakem prihajajočem treningu na nadzorni plošči sta prikazana gumba »Pridem« in »Ne pridem«, izbrani gumb pa je poudarjen, drugi pa ne.
2. Ob izbiri »Ne pridem« mora igralec izbrati razlog (bolezen, poškodba, šola/služba, drugo). Komentar do 200 znakov je neobvezen.
3. Igralec lahko odgovor spremeni do začetka treninga. Po začetku sta gumba onemogočena.
4. Trener v podrobnostih treninga vidi število igralcev, ki so potrdili udeležbo, ki so odsotni in ki še niso odgovorili.
5. Igralec lahko potrjuje samo svojo udeležbo. Zahteva za spremembo udeležbe drugega igralca vrne odgovor 403.

---

#### US-08 – Evidentiranje dejanske prisotnosti

| Oznaka | Povezana funkcionalnost | Uporabniška vloga |
|---|---|---|
| US-08 | F3 – Evidentiranje prisotnosti (MVP) | Trener |

Uporabniška zgodba:
Kot trener želim po treningu na enem zaslonu evidentirati dejansko prisotnost vseh igralcev, da je statistika prisotnosti točna in jo vnesem za vso ekipo naenkrat.

Acceptance criteria:

1. Zaslon prikaže vse igralce z veljavnim članstvom na dan treninga. Dejanska prisotnost je predizpolnjena glede na prijavo igralca (»Pridem« → prisoten, »Ne pridem« → opravičeno odsoten).
2. Za vsakega igralca lahko trener izbere »Prisoten«, »Opravičeno odsoten« ali »Neopravičeno odsoten«. Gumb »Označi vse prisotne« nastavi vse igralce na »Prisoten«.
3. Evidenco je mogoče shraniti šele po začetku treninga. Po shranjevanju trening dobi status »Izveden«.
4. Vsaka kasnejša sprememba prisotnosti se zabeleži v zgodovini sprememb (kdo, kdaj, stara in nova vrednost), ki je trenerju vidna pri treningu.

---

### F4 – Razpored tekem

#### US-09 – Ustvarjanje tekme

| Oznaka | Povezana funkcionalnost | Uporabniška vloga |
|---|---|---|
| US-09 | F4 – Razpored tekem (MVP) | Vodja ekipe |

Uporabniška zgodba:
Kot vodja ekipe želim v razpored dodati tekmo z nasprotnikom, terminom, lokacijo in vrsto tekmovanja, da so vsi člani ekipe pravočasno obveščeni o prihajajočih tekmah.

Acceptance criteria:

1. Obvezna polja so nasprotni klub (izbran iz evidence), datum in ura, domača ali gostujoča tekma, lokacija in vrsta tekmovanja (prvenstvo, pokal, prijateljska).
2. Po shranjevanju dobi tekma status »Načrtovana« in se prikaže v razporedu vseh članov ekipe.
3. Vodja ekipe lahko tekmo ureja ali odpove, dokler ima status »Načrtovana«.
4. Vodja ekipe na zaslonu tekme ne vidi polj za rezultat, postavo in dogodke. Te podatke lahko vnese samo trener ekipe.
5. Vodja ekipe lahko ustvari tekmo samo za ekipe, v katerih ima vlogo vodje ekipe.

---

#### US-10 – Evidenca nasprotnih klubov

| Oznaka | Povezana funkcionalnost | Uporabniška vloga |
|---|---|---|
| US-10 | F4 – Razpored tekem (MVP) | Vodja ekipe |

Uporabniška zgodba:
Kot vodja ekipe želim voditi evidenco nasprotnih klubov, da pri ustvarjanju tekme nasprotnika samo izberem in mi podatkov ni treba vnašati vsakič znova.

Acceptance criteria:

1. Nov nasprotni klub zahteva naziv (2–80 znakov) in kraj. Brez obeh polj se klub ne shrani.
2. Kluba z enakim nazivom in krajem, kot ga ima obstoječi klub, ni mogoče dodati. Prikaže se sporočilo »Klub že obstaja v evidenci«.
3. Pri ustvarjanju tekme se nasprotnik izbere iz seznama z iskanjem, ki po vnosu vsaj 2 znakov prikaže klube, katerih naziv vsebuje vneseno besedilo.
4. Kluba, ki je povezan z vsaj eno tekmo, ni mogoče izbrisati, mogoče pa ga je urejati.

---

### F5 – Poročila o tekmah

#### US-11 – Vnos rezultata in postave

| Oznaka | Povezana funkcionalnost | Uporabniška vloga |
|---|---|---|
| US-11 | F5 – Poročila o tekmah (MVP) | Trener |

Uporabniška zgodba:
Kot trener želim po tekmi vnesti rezultat, začetno postavo in igralne minute igralcev, da so podatki tekme shranjeni in uporabljeni v statistiki.

Acceptance criteria:

1. Poročilo je mogoče odpreti samo za tekme, katerih termin je že minil, in samo trenerju ekipe. Ob odprtju poročila tekma dobi status »Odigrana«.
2. Igralce za postavo in klop je mogoče izbrati samo s seznama igralcev z veljavnim članstvom v ekipi na dan tekme. Igralci s statusom »Poškodovan« ali »Odsoten« na dan tekme so označeni z opozorilom in jih je mogoče izbrati šele po potrditvi opozorila.
3. Začetna postava mora imeti natanko 11 igralcev. Če jih ni 11, se prikaže opozorilo in poročila ni mogoče potrditi.
4. Za vsakega igralca, ki je nastopil, trener vnese odigrane minute (celo število od 0 do 120).
5. Poročilo lahko trener shrani kot osnutek. Po kliku »Potrdi poročilo« tekma dobi status »Zaključena«, njeni podatki pa se vključijo v statistiko.

---

#### US-12 – Vnos dogodkov na tekmi

| Oznaka | Povezana funkcionalnost | Uporabniška vloga |
|---|---|---|
| US-12 | F5 – Poročila o tekmah (MVP) | Trener |

Uporabniška zgodba:
Kot trener želim v poročilo vnesti gole, asistence, menjave in kartone z minuto dogodka, da ima vsak igralec točno osebno statistiko.

Acceptance criteria:

1. Vsak dogodek ima vrsto (gol, asistenca, rumeni karton, rdeči karton, menjava), igralca in minuto (1–120). Dogodki so prikazani kronološko po minuti.
2. Število vnesenih golov naše ekipe se mora ujemati z rezultatom. Če se ne, se prikaže opozorilo »Število golov se ne ujema z rezultatom« in poročila ni mogoče potrditi.
3. Asistenca je vezana na gol in je ne more imeti isti igralec, ki je dosegel ta gol.
4. Pri menjavi trener izbere igralca, ki zapusti igrišče, in igralca, ki vstopi. Igralec, ki vstopi, mora biti na klopi in ne v začetni postavi.
5. Igralec z rdečim kartonom po minuti izključitve ne more imeti novih dogodkov.

---

#### US-13 – Popravek zaključenega poročila

| Oznaka | Povezana funkcionalnost | Uporabniška vloga |
|---|---|---|
| US-13 | F5 – Poročila o tekmah (MVP) | Trener |

Uporabniška zgodba:
Kot trener želim popraviti napako v že zaključenem poročilu o tekmi, da je statistika pravilna, sprememba pa ostane sledljiva.

Acceptance criteria:

1. Pri tekmi s statusom »Zaključena« je trenerju ekipe prikazan gumb »Popravi poročilo«, drugim vlogam pa ne.
2. Pred shranjevanjem popravka mora trener vnesti razlog popravka (10–200 znakov).
3. Sistem v zgodovini sprememb tekme zabeleži, kdo je naredil spremembo, kdaj, razlog ter stare in nove podatke.
4. Po shranjevanju se statistika igralcev in ekipe ponovno izračuna. Spremenjene vrednosti so vidne ob naslednjem odprtju statistike.
5. Zgodovina sprememb je na strani tekme vidna trenerju ekipe in administratorju, igralcem pa ne.

---

### F6 – Statistika igralcev in ekip

#### US-14 – Pregled osebne statistike

| Oznaka | Povezana funkcionalnost | Uporabniška vloga |
|---|---|---|
| US-14 | F6 – Statistika igralcev in ekip (MVP) | Igralec |

Uporabniška zgodba:
Kot igralec želim pregledati svojo statistiko po sezonah in ekipah, da spremljam svoj napredek skozi celotno športno pot v klubu.

Acceptance criteria:

1. Za izbrano sezono se prikažejo nastopi, nastopi v začetni postavi, odigrane minute, goli, asistence, rumeni in rdeči kartoni ter odstotek prisotnosti na treningih.
2. Statistiko je mogoče filtrirati po sezoni (privzeto trenutna) in ekipi, vključno s preteklimi sezonami in ekipami, iz katerih je igralec že odšel.
3. Odstotek prisotnosti se izračuna kot število treningov s statusom »Prisoten«, deljeno s številom izvedenih treningov v času igralčevega članstva. Odpovedani treningi se ne štejejo.
4. Upoštevajo se samo tekme s statusom »Zaključena«. Osnutki poročil na statistiko ne vplivajo.
5. Če igralec v izbrani sezoni nima nobenega nastopa ali treninga, se prikaže sporočilo »Za izbrano sezono ni podatkov«.

---

#### US-15 – Pregled statistike ekipe

| Oznaka | Povezana funkcionalnost | Uporabniška vloga |
|---|---|---|
| US-15 | F6 – Statistika igralcev in ekip (MVP) | Trener |

Uporabniška zgodba:
Kot trener želim na enem mestu videti statistiko ekipe in vseh njenih igralcev v sezoni, da lažje načrtujem postavo in trening.

Acceptance criteria:

1. Povzetek ekipe za izbrano sezono prikaže število odigranih tekem, zmage, remije, poraze ter dane in prejete gole.
2. Tabela igralcev prikaže nastope, minute, gole, asistence, kartone in odstotek prisotnosti. S klikom na glavo stolpca se tabela razvrsti po tem stolpcu.
3. S klikom na igralca se odpre njegova podrobna statistika po sezonah (nastopi, minute, goli, asistence, kartoni in prisotnost).
4. Trener vidi statistiko samo ekip, v katerih ima vlogo trenerja. Administrator vidi statistiko vseh ekip.

---

### F7 – Razpoložljivost igralcev

#### US-16 – Posodobitev razpoložljivosti

| Oznaka | Povezana funkcionalnost | Uporabniška vloga |
|---|---|---|
| US-16 | F7 – Razpoložljivost igralcev (MVP) | Igralec |

Uporabniška zgodba:
Kot igralec želim posodobiti svoj status razpoložljivosti, da trener ve, ali sem lahko izbran za trening in tekmo.

Acceptance criteria:

1. Igralec izbere enega od statusov »Na voljo«, »Odsoten«, »Poškodovan« ali »Omejeno treniranje«, datum začetka (privzeto današnji) in neobvezen datum konca.
2. Ob shranjevanju novega statusa se prejšnjemu statusu samodejno nastavi datum konca, oba pa ostaneta v zgodovini razpoložljivosti, ki jo igralec vidi na svojem profilu.
3. Ko poteče datum konca, se status igralca samodejno spremeni v »Na voljo«.
4. Nov status je trenerju viden v pregledu razpoložljivosti ob naslednjem nalaganju strani.

---

#### US-17 – Pregled razpoložljivosti pred tekmo

| Oznaka | Povezana funkcionalnost | Uporabniška vloga |
|---|---|---|
| US-17 | F7 – Razpoložljivost igralcev (MVP) | Trener |

Uporabniška zgodba:
Kot trener želim pred tekmo videti razpoložljivost vseh igralcev ekipe na dan tekme, da izberem postavo samo iz igralcev, ki lahko igrajo.

Acceptance criteria:

1. Pri tekmi je prikazan seznam igralcev ekipe z barvno oznako statusa: zelena »Na voljo«, rumena »Omejeno treniranje«, rdeča »Poškodovan«, siva »Odsoten«.
2. Status se izračuna za datum tekme in ne za današnji dan (npr. igralec, ki je poškodovan do dneva pred tekmo, je prikazan kot »Na voljo«).
3. Nad seznamom je prikazan povzetek s številom igralcev po posameznem statusu.

---

### Podporne funkcionalnosti – povabila in prijava

#### US-18 – Pošiljanje povabila

| Oznaka | Povezana funkcionalnost | Uporabniška vloga |
|---|---|---|
| US-18 | Podporna funkcionalnost MVP – povabila in prijava | Administrator kluba |

Uporabniška zgodba:
Kot administrator kluba želim novega člana povabiti v aplikacijo prek e-pošte, da se lahko sam registrira in dobi dostop do svoje ekipe.

Acceptance criteria:

1. Administrator vnese e-poštni naslov, ekipo, sezono in vlogo. Po kliku »Pošlji povabilo« sistem na naslov pošlje e-pošto s povezavo za registracijo.
2. Povezava vsebuje enkraten žeton in velja 7 dni od pošiljanja.
3. Če je e-poštni naslov že povezan z obstoječim računom, se povabilo ne pošlje, prikaže pa se sporočilo »Uporabnik že obstaja – dodajte ga v ekipo«.
4. Administrator vidi seznam povabil s statusi »Poslano«, »Sprejeto« in »Poteklo« ter lahko poteklo povabilo pošlje znova.

---

#### US-19 – Sprejem povabila

| Oznaka | Povezana funkcionalnost | Uporabniška vloga |
|---|---|---|
| US-19 | Podporna funkcionalnost MVP – povabila in prijava | Povabljeni uporabnik |

Uporabniška zgodba:
Kot povabljeni uporabnik želim prek povezave v povabilu nastaviti svoje podatke in geslo, da ustvarim račun in dobim dostop do svoje ekipe.

Acceptance criteria:

1. Obrazec za registracijo ima predizpolnjen e-poštni naslov iz povabila, ki ga ni mogoče spremeniti. Uporabnik vnese ime, priimek in geslo.
2. Geslo mora imeti vsaj 8 znakov ter vsaj eno črko in eno številko. Polji »Geslo« in »Ponovi geslo« se morata ujemati.
3. Po uspešni registraciji je uporabnik prijavljen, preusmerjen na nadzorno ploščo in dodan v ekipo z vlogo iz povabila.
4. Že uporabljena ali potekla povezava prikaže sporočilo »Povabilo ni več veljavno – obrnite se na administratorja kluba«.

---

#### US-20 – Prijava in odjava

| Oznaka | Povezana funkcionalnost | Uporabniška vloga |
|---|---|---|
| US-20 | Podporna funkcionalnost MVP – povabila in prijava | Vsi uporabniki (administrator, trener, igralec, vodja ekipe) |

Uporabniška zgodba:
Kot registriran uporabnik želim se prijaviti z e-poštnim naslovom in geslom ter se odjaviti, da varno dostopam do podatkov svojih ekip.

Acceptance criteria:

1. Ob pravilnem e-poštnem naslovu in geslu je uporabnik preusmerjen na nadzorno ploščo, ki prikazuje samo ekipe, v katerih je član.
2. Ob napačnem e-poštnem naslovu ali geslu se prikaže enotno sporočilo »Napačen e-poštni naslov ali geslo«, ne glede na to, kateri podatek je napačen.
3. Po 5 zaporednih neuspešnih poskusih v 15 minutah se prijava za ta račun za 15 minut onemogoči.
4. Po kliku »Odjava« se seja na strežniku uniči. Ponoven obisk zaščitene strani (tudi z gumbom »Nazaj« v brskalniku) preusmeri na prijavno stran.
