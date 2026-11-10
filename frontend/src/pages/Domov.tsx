import { Link } from 'react-router-dom';
import { api } from '../api';
import { useUporabnik } from '../auth';
import { MojaRazpolozljivostKartica } from '../components/razpolozljivost';
import { KarticaTekme } from '../components/tekme';
import { KarticaTreninga } from '../components/treningi';
import { GlavaStrani, Kartica, Stanje, useNalozi, Znacka } from '../components/ui';
import { KATEGORIJE, VLOGE, type Tekma, type Trening } from '../tipi';

/** Nadzorna plošča (WF-01): prihajajoče aktivnosti s potrjevanjem udeležbe in ekipe uporabnika. */
export function Domov() {
  const uporabnik = useUporabnik();
  const treningi = useNalozi(() => api.get<Trening[]>('/treningi?obdobje=prihajajoci'));
  const tekme = useNalozi(() => api.get<Tekma[]>('/tekme?obdobje=prihajajoce'));

  // Treningi in tekme skupaj, razvrščeni po času.
  const aktivnosti = [
    ...(treningi.podatki ?? []).map((t) => ({ vrsta: 'trening' as const, cas: t.zacetek, trening: t })),
    ...(tekme.podatki ?? []).map((t) => ({ vrsta: 'tekma' as const, cas: t.datumInUra, tekma: t })),
  ]
    .sort((a, b) => a.cas.localeCompare(b.cas))
    .slice(0, 8);
  const nalozeno = treningi.podatki !== null && tekme.podatki !== null;

  const podnaslov =
    uporabnik.ekipe.length > 0
      ? uporabnik.ekipe.map((e) => `${e.naziv} (${e.vloge.map((v) => VLOGE[v].toLowerCase()).join(', ')})`).join(' · ')
      : uporabnik.jeAdministrator
        ? 'Administrator kluba'
        : 'Trenutno niste član nobene ekipe';

  return (
    <>
      <GlavaStrani naslov={`Pozdravljeni, ${uporabnik.ime}`} podnaslov={podnaslov} />
      <div className="mreza-2">
        <Kartica naslov="Prihajajoče aktivnosti" dejanja={<span className="dejanja"><Link to="/treningi">Treningi →</Link><Link to="/tekme">Tekme →</Link></span>}>
          <Stanje nalaganje={treningi.nalaganje || tekme.nalaganje} napaka={treningi.napaka ?? tekme.napaka} />
          {nalozeno && aktivnosti.length === 0 && <p className="tiho">Ni prihajajočih aktivnosti.</p>}
          {nalozeno && aktivnosti.length > 0 && (
            <ul className="seznam">
              {aktivnosti.map((a) =>
                a.vrsta === 'trening' ? (
                  <KarticaTreninga key={`t${a.trening.id}`} trening={a.trening} uporabnikId={uporabnik.id} obSpremembi={treningi.osvezi} />
                ) : (
                  <KarticaTekme key={`m${a.tekma.id}`} tekma={a.tekma} />
                ),
              )}
            </ul>
          )}
        </Kartica>

        <div>
          {uporabnik.ekipe.some((e) => e.vloge.includes('IGRALEC')) && <MojaRazpolozljivostKartica />}
          <Kartica naslov="Moje ekipe">
            {uporabnik.ekipe.length === 0 ? (
              <p className="tiho">
                {uporabnik.jeAdministrator
                  ? 'Niste član nobene ekipe. Kot administrator upravljate vse ekipe kluba.'
                  : 'Trenutno niste član nobene ekipe.'}
              </p>
            ) : (
              <ul className="seznam">
                {uporabnik.ekipe.map((e) => (
                  <li key={e.id} className="vrstica">
                    <span>
                      <Link to={`/ekipe/${e.id}`}>
                        <strong>{e.naziv}</strong>
                      </Link>{' '}
                      <span className="tiho">· {KATEGORIJE[e.kategorija]}</span>
                    </span>
                    <span className="dejanja">
                      {e.vloge.map((v) => (
                        <Znacka key={v} barva={v === 'IGRALEC' ? 'zelena' : 'modra'}>
                          {VLOGE[v]}
                        </Znacka>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Kartica>
        </div>
      </div>
    </>
  );
}
