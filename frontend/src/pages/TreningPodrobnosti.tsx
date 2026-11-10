import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api';
import { ObrazecTreninga, terminTreninga, ZnackaTreninga } from '../components/treningi';
import { GlavaStrani, Kartica, Modal, Obvestilo, Stanje, useNalozi, useOddaja } from '../components/ui';
import type { Trening } from '../tipi';

export function TreningPodrobnosti() {
  const id = Number(useParams().id);
  const trening = useNalozi(() => api.get<Trening>(`/treningi/${id}`), [id]);
  const [urejanje, setUrejanje] = useState(false);
  const [potrditevOdpovedi, setPotrditevOdpovedi] = useState(false);
  const [uspeh, setUspeh] = useState<string | null>(null);
  const odpoved = useOddaja();

  if (!trening.podatki) return <Stanje nalaganje={trening.nalaganje} napaka={trening.napaka} />;
  const t = trening.podatki;
  // Urejanje in odpoved sta mogoča samo pri načrtovanem treningu; pri izvedenem gumba nista prikazana (US-06, AC 5).
  const lahkoUreja = t.jeTrener && t.status === 'NACRTOVAN';

  async function odpovej() {
    const ok = await odpoved.oddaj(() => api.post(`/treningi/${id}/odpovej`));
    setPotrditevOdpovedi(false);
    if (ok) {
      setUspeh('Trening je odpovedan. V razporedu igralcev ostane prikazan prečrtano.');
      await trening.osvezi();
    }
  }

  return (
    <>
      <GlavaStrani
        naslov={<span className={t.status === 'ODPOVEDAN' ? 'precrtano' : undefined}>Trening · {terminTreninga(t)}</span>}
        podnaslov={
          <>
            <Link to="/treningi">Treningi</Link> · <Link to={`/ekipe/${t.ekipa.id}`}>{t.ekipa.naziv}</Link>
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
        <Kartica naslov="Sprememba treninga">
          <ObrazecTreninga
            trening={t}
            obPreklicu={() => setUrejanje(false)}
            obUspehu={async () => {
              setUrejanje(false);
              setUspeh('Trening je spremenjen. Igralci ga v razporedu vidijo z oznako »Spremenjeno«.');
              await trening.osvezi();
            }}
          />
        </Kartica>
      ) : (
        <Kartica naslov="Podatki o treningu" dejanja={<ZnackaTreninga trening={t} />}>
          <table>
            <tbody>
              <tr>
                <th>Termin</th>
                <td>{terminTreninga(t)}</td>
              </tr>
              <tr>
                <th>Lokacija</th>
                <td>{t.lokacija}</td>
              </tr>
              <tr>
                <th>Vsebina</th>
                <td style={{ whiteSpace: 'pre-wrap' }}>{t.vsebina ?? <span className="tiho">ni vpisana</span>}</td>
              </tr>
            </tbody>
          </table>
        </Kartica>
      )}

      {potrditevOdpovedi && (
        <Modal naslov="Odpoved treninga" obZaprtju={() => setPotrditevOdpovedi(false)}>
          <p>Ali res želite odpovedati trening {terminTreninga(t)}?</p>
          <p className="tiho majhno">Igralci pri odpovedanem treningu ne morejo več potrjevati udeležbe.</p>
          <div className="dejanja">
            <button className="gumb gumb-nevaren" onClick={odpovej} disabled={odpoved.posiljanje}>
              Odpovej trening
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
