import { useState } from 'react';
import { api } from '../api';
import { useUporabnik } from '../auth';
import { ObrazecTreninga, terminTreninga, ZnackaTreninga } from '../components/treningi';
import { GlavaStrani, Kartica, Obvestilo, Stanje, useNalozi } from '../components/ui';
import type { Trening } from '../tipi';

export function Treningi() {
  const uporabnik = useUporabnik();
  const [obdobje, setObdobje] = useState<'prihajajoci' | 'pretekli'>('prihajajoci');
  const treningi = useNalozi(() => api.get<Trening[]>(`/treningi?obdobje=${obdobje}`), [obdobje]);
  const [obrazecOdprt, setObrazecOdprt] = useState(false);
  const [uspeh, setUspeh] = useState<string | null>(null);

  // V izbirnem seznamu so samo aktivne ekipe, v katerih je uporabnik trener (US-05, AC 5).
  const trenerskeEkipe = uporabnik.ekipe.filter((e) => e.vloge.includes('TRENER') && !e.jeArhivirana);
  const kaziPovzetek = treningi.podatki?.some((t) => t.povzetek) ?? false;

  return (
    <>
      <GlavaStrani
        naslov="Treningi"
        dejanja={
          trenerskeEkipe.length > 0 &&
          !obrazecOdprt && (
            <button className="gumb gumb-glavni" onClick={() => { setObrazecOdprt(true); setUspeh(null); }}>
              Nov trening
            </button>
          )
        }
      />
      {uspeh && <Obvestilo vrsta="uspeh">{uspeh}</Obvestilo>}
      {obrazecOdprt && (
        <Kartica naslov="Nov trening">
          <ObrazecTreninga
            ekipe={trenerskeEkipe}
            obPreklicu={() => setObrazecOdprt(false)}
            obUspehu={async (t) => {
              setObrazecOdprt(false);
              setObdobje('prihajajoci');
              setUspeh(`Trening ekipe ${t.ekipa.naziv} je ustvarjen in viden v razporedu igralcev.`);
              await treningi.osvezi();
            }}
          />
        </Kartica>
      )}
      <Kartica
        dejanja={
          <div className="dejanja" role="group" aria-label="Obdobje">
            <button className={`gumb gumb-majhen${obdobje === 'prihajajoci' ? ' gumb-glavni' : ''}`} onClick={() => setObdobje('prihajajoci')}>
              Prihajajoči
            </button>
            <button className={`gumb gumb-majhen${obdobje === 'pretekli' ? ' gumb-glavni' : ''}`} onClick={() => setObdobje('pretekli')}>
              Pretekli
            </button>
          </div>
        }
      >
        <Stanje nalaganje={treningi.nalaganje} napaka={treningi.napaka} />
        {treningi.podatki && treningi.podatki.length === 0 && (
          <p className="tiho">{obdobje === 'prihajajoci' ? 'Ni prihajajočih treningov.' : 'Ni preteklih treningov.'}</p>
        )}
        {treningi.podatki && treningi.podatki.length > 0 && (
          <div className="tabela-ovoj">
            <table>
              <thead>
                <tr>
                  <th>Termin</th>
                  <th>Ekipa</th>
                  <th>Lokacija</th>
                  <th>Status</th>
                  {kaziPovzetek && <th>Prijave</th>}
                </tr>
              </thead>
              <tbody>
                {treningi.podatki.map((t) => (
                  <tr key={t.id}>
                    <td className={t.status === 'ODPOVEDAN' ? 'precrtano' : undefined}>
                      <strong>{terminTreninga(t)}</strong>
                      {t.vsebina && <div className="tiho majhno">{t.vsebina}</div>}
                    </td>
                    <td>{t.ekipa.naziv}</td>
                    <td>{t.lokacija}</td>
                    <td>
                      <ZnackaTreninga trening={t} />
                    </td>
                    {kaziPovzetek && (
                      <td className="majhno">
                        {t.povzetek && t.status !== 'ODPOVEDAN'
                          ? `${t.povzetek.pride} pride · ${t.povzetek.nePride} ne pride · ${t.povzetek.niOdgovora} brez odgovora`
                          : '–'}
                      </td>
                    )}
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
