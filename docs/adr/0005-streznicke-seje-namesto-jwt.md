# ADR-0005 – Avtentikacija s strežniškimi sejami namesto JWT

- **Status:** sprejeto
- **Datum:** 2026-10-14
- **Nadomešča:** –

## Kontekst in problem

Uporabniki se prijavijo z e-poštnim naslovom in geslom, sistem pa mora pri vsaki zahtevi vedeti, kdo je uporabnik, in preveriti njegove pravice. Aplikacija hrani osebne podatke igralcev (tudi mladoletnih), zato mora biti prijava varna. Zahtevano je, da se ob odjavi seja dejansko uniči (US-20) in da je po več neuspešnih poskusih prijava začasno onemogočena. Odločiti se moramo, kako hraniti stanje prijave in kako shranjevati gesla.

## Obravnavane alternative

1. Strežniške seje (express-session, seje v bazi) s HttpOnly piškotkom
2. JWT-žetoni, shranjeni v `localStorage` brskalnika
3. JWT-žetoni v HttpOnly piškotku
4. Zunanji ponudnik identitete (npr. Auth0, Firebase Auth)

## Odločitev

Izbrana alternativa: »Strežniške seje s HttpOnly piškotkom«, ker:

- je sejo mogoče kadarkoli preklicati na strežniku (odjava, onemogočen račun, sprememba vlog), medtem ko JWT velja do izteka in ga je težko preklicati,
- HttpOnly piškotek ni dosegljiv iz JavaScripta, zato ga ni mogoče ukrasti z napadom XSS, kar je glavna slabost hranjenja žetona v `localStorage`,
- gre za eno aplikacijo z enim backendom, zato prednosti JWT (brezstanjskost, deljenje med več storitvami) tu ne pridejo do izraza,
- zunanji ponudnik bi dodal odvisnost in stroške ter otežil prijavo prek povabil, ki je specifična za naš sistem.

Gesla se shranjujejo kot zgoščene vrednosti z algoritmom **Argon2id**, ki je trenutno priporočen algoritem za gesla (OWASP) in je zaradi porabe pomnilnika odpornejši na napade z grafičnimi karticami kot bcrypt ali PBKDF2.

## Posledice

### Pozitivne

- Takojšnja odjava in preklic dostopa.
- Žeton seje ni izpostavljen JavaScriptu v brskalniku.
- Preprosta implementacija z znano knjižnico.

### Negativne

- Strežnik mora hraniti seje (tabela `Seja`), kar pomeni dodatno poizvedbo pri vsaki zahtevi.
- Ker brskalnik piškotke pošilja samodejno, je potrebna zaščita pred CSRF (npr. atribut `SameSite` in CSRF-žeton).
- Pri ločenem frontendu in backendu je treba pravilno nastaviti CORS in piškotke (glej [ADR-0001](0001-locen-frontend-in-backend.md)).
- Za mobilno aplikacijo bo morda treba v prihodnosti dodati drug način avtentikacije.
