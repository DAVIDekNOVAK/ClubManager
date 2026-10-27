# 03 – Podatkovni model

## 1. Opis podatkovnega modela

ClubManager bo uporabljal relacijsko podatkovno bazo PostgreSQL. Podatki bodo organizirani v povezane tabele za upravljanje uporabnikov, ekip, sezon, treningov, tekem in statistike.

## 2. Entitete in glavna polja

| Entiteta                       | Namen                                 | Glavna polja |
|--------------------------------|---------------------------------------|--------------|
| Uporabnik                      | Podatki o uporabnikih                 | id (PK), ime, priimek, ePosta, gesloHash, jeAdministrator |
| Ekipa                          | Nogometne ekipe kluba                 | id (PK), naziv, kategorija, jeArhivirana |
| Sezona                         | Tekmovalne sezone                     | id (PK), naziv, datumZacetka, datumKonca, status |
| Članstvo v ekipi               | Članstvo uporabnika v ekipi in sezoni | id (PK), uporabnikId (FK), ekipaId (FK), sezonaId datumPridruzitve, datumOdhoda |
| Vloga člana                    | Vloge uporabnika v posamezni ekipi    | id (PK), clanstvoId (FK), vloga |
| Trening                        | Načrtovani treningi                   | id (PK), ekipaId (FK), sezonaId (FK), datumInUra, lokacija, status |
| Prisotnost                     | Prijavljena in dejanska prisotnost    | id (PK), treningId (FK), igralecId (FK), prijavljenaPrisotnost, dejanskaPrisotnost |
| Zgodovina sprememb prisotnosti | Evidenca popravkov prisotnosti        | id (PK), prisotnostId (FK), spremenilId (FK), staraVrednost, novaVrednost, datumSpremembe |
| Tekma                          | Tekme in rezultati                    | id (PK), ekipaId (FK), sezonaId (FK), nasprotniKlubId (FK), datum, domaciGoli, gostujociGoli, status |
| Nasprotni klub                 | Evidenca nasprotnih klubov            | id (PK), naziv, kraj |
| Nastop na tekmi                | Nastopi igralcev na tekmah            | id (PK), tekmaId (FK), igralecId (FK), zacetnaPostava, odigraneMinute |
| Dogodek na tekmi               | Goli, asistence, menjave in kartoni   | id (PK), tekmaId (FK), igralecId (FK), vrstaDogodka, minuta |
| Zgodovina sprememb tekme       | Evidenca popravkov poročil            | id (PK), tekmaId (FK), spremenilId (FK), vrstaSpremembe, stariPodatki, noviPodatki, datumSpremembe |
| Razpoložljivost igralca        | Zgodovina razpoložljivosti igralcev   | id (PK), igralecId (FK), status, veljaOd, veljaDo |
| Povabilo                       | Povabila za vključitev uporabnikov    | id (PK), ePosta, zgoscenaVrednostZetona, vloga, datumPoteka, datumSprejetja |
| Seja                           | Shranjevanje prijavnih sej            | id (PK), podatkiSeje, datumPoteka |

PK – primarni ključ, FK – tuji ključ.

## 3. Povezave med entitetami

| Entiteta A       | Povezava | Entiteta B                     | Opis                                    |
|------------------|----------|--------------------------------|-----------------------------------------|
| Uporabnik        | 1:N      | Članstvo v ekipi               | Uporabnik je lahko član več ekip        |
| Ekipa            | 1:N      | Članstvo v ekipi               | Ekipa ima več članov                    |
| Sezona           | 1:N      | Članstvo v ekipi               | Članstva so vezana na sezono            |
| Članstvo v ekipi | 1:N      | Vloga člana                    | Član ima lahko več vlog                 |
| Ekipa            | 1:N      | Trening                        | Ekipa ima več treningov                 |
| Sezona           | 1:N      | Trening                        | Trening pripada sezoni                  |
| Trening          | 1:N      | Prisotnost                     | Trening ima več evidenc prisotnosti     |
| Uporabnik        | 1:N      | Prisotnost                     | Igralec ima več evidenc prisotnosti     |
| Prisotnost       | 1:N      | Zgodovina sprememb prisotnosti | Evidenca ima zgodovino sprememb         |
| Ekipa            | 1:N      | Tekma                          | Ekipa odigra več tekem                  |
| Sezona           | 1:N      | Tekma                          | Tekma pripada sezoni                    |
| Nasprotni klub   | 1:N      | Tekma                          | Nasprotni klub nastopa na več tekmah    |
| Tekma            | 1:N      | Nastop na tekmi                | Tekma ima več nastopajočih igralcev     |
| Uporabnik        | 1:N      | Nastop na tekmi                | Igralec lahko nastopi na več tekmah     |
| Tekma            | 1:N      | Dogodek na tekmi               | Tekma vsebuje več dogodkov              |
| Tekma            | 1:N      | Zgodovina sprememb tekme       | Poročilo ima zgodovino popravkov        |
| Uporabnik        | 1:N      | Razpoložljivost igralca        | Igralec ima zgodovino razpoložljivosti  |
| Uporabnik        | 1:N      | Povabilo                       | Administrator lahko ustvari več povabil |
| Uporabnik        | 1:N      | Seja                           | Uporabnik ima lahko več prijavnih sej   |

## 4. Osnovna pravila podatkovnega modela

- Igralec lahko pripada več ekipam v isti sezoni.
- Uporabnik lahko opravlja več vlog glede na ekipo.
- Treningi in tekme so povezani z ekipo in sezono.
- Na tekmi lahko nastopajo samo igralci z veljavnim članstvom v ekipi.
- Za posameznega igralca in trening obstaja največ ena evidenca prisotnosti.
- Popravki prisotnosti in poročil o tekmah se beležijo v zgodovini sprememb.
- Statistika se dinamično izračunava iz podatkov o treningih in tekmah.
- Arhiviranje ekip ne izbriše zgodovinskih podatkov.
