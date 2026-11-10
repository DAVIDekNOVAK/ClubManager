import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useUporabnik } from '../auth';
import { izpisRezultata, naslovTekme, ObrazecTekme, opisTekme, ZnackaTekme } from '../components/tekme';
import { GlavaStrani, Kartica, Obvestilo, Stanje, useNalozi } from '../components/ui';
import type { Tekma } from '../tipi';

export function Tekme() {
  const uporabnik = useUporabnik();
  const [obdobje, setObdobje] = useState<'prihajajoce' | 'pretekle'>('prihajajoce');
  const tekme = useNalozi(() => api.get<Tekma[]>(`/tekme?obdobje=${obdobje}`), [obdobje]);
  const [obrazecOdprt, setObrazecOdprt] = useState(false);
  const [uspeh, setUspeh] = useState<string | null>(null);

  // Tekmo lahko doda vodja ekipe, in sicer samo za svoje aktivne ekipe (US-09, AC 5).
  const vodjaEkip = uporabnik.ekipe.filter((e) => e.vloge.includes('VODJA_EKIPE') && !e.jeArhivirana);

  return (
    <>
      <GlavaStrani
        naslov="Tekme"
        dejanja={
          vodjaEkip.length > 0 &&
          !obrazecOdprt && (
            <button className="gumb gumb-glavni" onClick={() => { setObrazecOdprt(true); setUspeh(null); }}>
              Nova tekma
            </button>
          )
        }
      />
      {uspeh && <Obvestilo vrsta="uspeh">{uspeh}</Obvestilo>}
      {obrazecOdprt && (
        <Kartica naslov="Nova tekma">
          <ObrazecTekme
            ekipe={vodjaEkip}
            obPreklicu={() => setObrazecOdprt(false)}
            obUspehu={async (t) => {
              setObrazecOdprt(false);
              setObdobje('prihajajoce');
              setUspeh(`Tekma ${naslovTekme(t)} je dodana v razpored.`);
              await tekme.osvezi();
            }}
          />
        </Kartica>
      )}
      <Kartica
        dejanja={
          <div className="dejanja" role="group" aria-label="Obdobje">
            <button className={`gumb gumb-majhen${obdobje === 'prihajajoce' ? ' gumb-glavni' : ''}`} onClick={() => setObdobje('prihajajoce')}>
              Prihajajoče
            </button>
            <button className={`gumb gumb-majhen${obdobje === 'pretekle' ? ' gumb-glavni' : ''}`} onClick={() => setObdobje('pretekle')}>
              Pretekle
            </button>
          </div>
        }
      >
        <Stanje nalaganje={tekme.nalaganje} napaka={tekme.napaka} />
        {tekme.podatki && tekme.podatki.length === 0 && (
          <p className="tiho">{obdobje === 'prihajajoce' ? 'Ni prihajajočih tekem.' : 'Ni preteklih tekem.'}</p>
        )}
        {tekme.podatki && tekme.podatki.length > 0 && (
          <div className="tabela-ovoj">
            <table>
              <thead>
                <tr>
                  <th>Tekma</th>
                  <th>Termin</th>
                  <th>Lokacija</th>
                  <th>Rezultat</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {tekme.podatki.map((t) => (
                  <tr key={t.id}>
                    <td className={t.status === 'ODPOVEDANA' ? 'precrtano' : undefined}>
                      <Link to={`/tekme/${t.id}`}>
                        <strong>{naslovTekme(t)}</strong>
                      </Link>
                    </td>
                    <td>{opisTekme(t)}</td>
                    <td>{t.lokacija}</td>
                    <td>
                      <strong>{izpisRezultata(t) ?? '–'}</strong>
                    </td>
                    <td>
                      <ZnackaTekme tekma={t} />
                    </td>
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
