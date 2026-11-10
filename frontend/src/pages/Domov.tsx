import { Link } from 'react-router-dom';
import { api } from '../api';
import { useUporabnik } from '../auth';
import { KarticaTreninga } from '../components/treningi';
import { GlavaStrani, Kartica, Stanje, useNalozi, Znacka } from '../components/ui';
import { KATEGORIJE, VLOGE, type Trening } from '../tipi';

/** Nadzorna plošča (WF-01): prihajajoče aktivnosti s potrjevanjem udeležbe in ekipe uporabnika. */
export function Domov() {
  const uporabnik = useUporabnik();
  const treningi = useNalozi(() => api.get<Trening[]>('/treningi?obdobje=prihajajoci'));

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
        <Kartica naslov="Prihajajoče aktivnosti" dejanja={<Link to="/treningi">Ves razpored →</Link>}>
          <Stanje nalaganje={treningi.nalaganje} napaka={treningi.napaka} />
          {treningi.podatki && treningi.podatki.length === 0 && <p className="tiho">Ni prihajajočih aktivnosti.</p>}
          {treningi.podatki && treningi.podatki.length > 0 && (
            <ul className="seznam">
              {treningi.podatki.slice(0, 8).map((t) => (
                <KarticaTreninga key={t.id} trening={t} uporabnikId={uporabnik.id} obSpremembi={treningi.osvezi} />
              ))}
            </ul>
          )}
        </Kartica>

        <div>
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
