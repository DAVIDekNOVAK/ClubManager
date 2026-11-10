import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api';
import { useUporabnik } from '../auth';
import { RazpolozljivostTekme } from '../components/razpolozljivost';
import { izpisRezultata, naslovTekme, ObrazecTekme, ZnackaTekme } from '../components/tekme';
import { GlavaStrani, Kartica, Modal, Obvestilo, Stanje, useNalozi, useOddaja } from '../components/ui';
import { datumUra } from '../format';
import { VRSTE_TEKMOVANJA, type Tekma } from '../tipi';

export function TekmaPodrobnosti() {
  const id = Number(useParams().id);
  const uporabnik = useUporabnik();
  const tekma = useNalozi(() => api.get<Tekma>(`/tekme/${id}`), [id]);
  const [urejanje, setUrejanje] = useState(false);
  const [potrditevOdpovedi, setPotrditevOdpovedi] = useState(false);
  const [uspeh, setUspeh] = useState<string | null>(null);
  const odpoved = useOddaja();

  if (!tekma.podatki) return <Stanje nalaganje={tekma.nalaganje} napaka={tekma.napaka} />;
  const t = tekma.podatki;
  // Vodja ekipe tekmo ureja ali odpove, dokler je »Načrtovana« (US-09, AC 3).
  const lahkoUreja = t.jeVodja && t.status === 'NACRTOVANA';

  async function odpovej() {
    const ok = await odpoved.oddaj(() => api.post(`/tekme/${id}/odpovej`));
    setPotrditevOdpovedi(false);
    if (ok) {
      setUspeh('Tekma je odpovedana.');
      await tekma.osvezi();
    }
  }

  return (
    <>
      <GlavaStrani
        naslov={<span className={t.status === 'ODPOVEDANA' ? 'precrtano' : undefined}>{naslovTekme(t)}</span>}
        podnaslov={
          <>
            <Link to="/tekme">Tekme</Link> · <Link to={`/ekipe/${t.ekipa.id}`}>{t.ekipa.naziv}</Link> · {datumUra(t.datumInUra)}
          </>
        }
        dejanja={
          lahkoUreja &&
          !urejanje && (
            <>
              <button className="gumb" onClick={() => { setUrejanje(true); setUspeh(null); }}>
                Uredi
              </button>
              <button className="gumb gumb-nevaren" onClick={() => setPotrditevOdpovedi(true)}>
                Odpovej
              </button>
            </>
          )
        }
      />
      {uspeh && <Obvestilo vrsta="uspeh">{uspeh}</Obvestilo>}
      {odpoved.napaka && <Obvestilo vrsta="napaka">{odpoved.napaka}</Obvestilo>}

      {urejanje ? (
        <Kartica naslov="Urejanje tekme">
          <ObrazecTekme
            tekma={t}
            obPreklicu={() => setUrejanje(false)}
            obUspehu={async () => {
              setUrejanje(false);
              setUspeh('Tekma je posodobljena.');
              await tekma.osvezi();
            }}
          />
        </Kartica>
      ) : (
        <Kartica naslov="Podatki o tekmi" dejanja={<ZnackaTekme tekma={t} />}>
          <table>
            <tbody>
              <tr>
                <th>Nasprotnik</th>
                <td>
                  {t.nasprotniKlub.naziv} <span className="tiho">· {t.nasprotniKlub.kraj}</span>
                </td>
              </tr>
              <tr>
                <th>Termin</th>
                <td>{datumUra(t.datumInUra)}</td>
              </tr>
              <tr>
                <th>Igrišče</th>
                <td>
                  {t.jeDomaca ? 'Domača tekma' : 'Gostujoča tekma'} · {t.lokacija}
                </td>
              </tr>
              <tr>
                <th>Tekmovanje</th>
                <td>{VRSTE_TEKMOVANJA[t.vrstaTekmovanja]}</td>
              </tr>
              {t.rezultat && (
                <tr>
                  <th>Rezultat</th>
                  <td>
                    <strong>{izpisRezultata(t)}</strong>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Kartica>
      )}

      {/* Trener (in administrator) pred tekmo vidi razpoložljivost igralcev na dan tekme (US-17). */}
      {(t.jeTrener || uporabnik.jeAdministrator) && t.status !== 'ODPOVEDANA' && (
        <RazpolozljivostTekme tekmaId={t.id} datumTekme={t.datumInUra} />
      )}

      {potrditevOdpovedi && (
        <Modal naslov="Odpoved tekme" obZaprtju={() => setPotrditevOdpovedi(false)}>
          <p>Ali res želite odpovedati tekmo {naslovTekme(t)}?</p>
          <div className="dejanja">
            <button className="gumb gumb-nevaren" onClick={odpovej} disabled={odpoved.posiljanje}>
              Odpovej tekmo
            </button>
            <button className="gumb" onClick={() => setPotrditevOdpovedi(false)}>
              Prekliči
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
