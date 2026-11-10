import { Link, useParams } from 'react-router-dom';
import { api } from '../api';
import { useUporabnik } from '../auth';
import { GlavaStrani, Kartica, Stanje, useNalozi, Znacka } from '../components/ui';
import { datum } from '../format';
import { polnoIme, VLOGE, type Profil } from '../tipi';

/** Profil uporabnika z vsemi članstvi. Brez parametra prikaže profil prijavljenega uporabnika. */
export function ProfilStran() {
  const jaz = useUporabnik();
  const id = Number(useParams().id ?? jaz.id);
  const { podatki: profil, napaka, nalaganje } = useNalozi(() => api.get<Profil>(`/uporabniki/${id}`), [id]);

  if (!profil) return <Stanje nalaganje={nalaganje} napaka={napaka} />;

  return (
    <>
      <GlavaStrani
        naslov={polnoIme(profil)}
        podnaslov={
          <>
            {profil.ePosta}
            {profil.jeAdministrator && ' · administrator kluba'}
          </>
        }
      />
      <Kartica naslov="Članstva v ekipah">
        {profil.clanstva.length === 0 ? (
          <p className="tiho">Uporabnik ni član nobene ekipe.</p>
        ) : (
          <div className="tabela-ovoj">
            <table>
              <thead>
                <tr>
                  <th>Ekipa</th>
                  <th>Sezona</th>
                  <th>Vloge</th>
                  <th>Pridružitev</th>
                  <th>Odhod</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {profil.clanstva.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <Link to={`/ekipe/${c.ekipa.id}`}>{c.ekipa.naziv}</Link>
                    </td>
                    <td>{c.sezona.naziv}</td>
                    <td>{c.vloge.map((v) => VLOGE[v]).join(', ')}</td>
                    <td>{datum(c.datumPridruzitve)}</td>
                    <td>{datum(c.datumOdhoda)}</td>
                    <td>{c.jeAktivno ? <Znacka barva="zelena">Aktivno</Znacka> : <Znacka>Preteklo</Znacka>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Kartica>
    </>
  );
}
