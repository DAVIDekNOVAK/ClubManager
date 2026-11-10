import { useUporabnik } from '../auth';
import { GlavaStrani, Kartica, Znacka } from '../components/ui';
import { KATEGORIJE, VLOGE } from '../tipi';

export function Domov() {
  const uporabnik = useUporabnik();

  return (
    <>
      <GlavaStrani naslov="Nadzorna plošča" podnaslov={`Pozdravljeni, ${uporabnik.ime}!`} />
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
                  <strong>{e.naziv}</strong> <span className="tiho">· {KATEGORIJE[e.kategorija]}</span>
                </span>
                <span className="dejanja">
                  {e.vloge.map((v) => (
                    <Znacka key={v} barva="zelena">
                      {VLOGE[v]}
                    </Znacka>
                  ))}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Kartica>
    </>
  );
}
