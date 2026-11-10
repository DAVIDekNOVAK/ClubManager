import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api';
import { useUporabnik } from '../auth';
import { Kartoni, Prisotnost } from '../components/statistika';
import { GlavaStrani, Kartica, Obvestilo, Stanje, useNalozi } from '../components/ui';
import { odstotek, polnoIme, type OsebnaStatistika } from '../tipi';

/** Statistika igralca po sezonah in ekipah (US-14). Brez parametra prikaže statistiko prijavljenega igralca. */
export function StatistikaIgralcaStran() {
  const jaz = useUporabnik();
  const igralecId = Number(useParams().id ?? jaz.id);
  const [sezonaId, setSezonaId] = useState<number | null>(null);
  const [ekipaId, setEkipaId] = useState<number | null>(null);
  const stat = useNalozi(() => {
    const parametri = new URLSearchParams();
    if (sezonaId) parametri.set('sezonaId', String(sezonaId));
    if (ekipaId) parametri.set('ekipaId', String(ekipaId));
    return api.get<OsebnaStatistika>(`/statistika/igralec/${igralecId}?${parametri}`);
  }, [igralecId, sezonaId, ekipaId]);

  if (!stat.podatki) return <Stanje nalaganje={stat.nalaganje} napaka={stat.napaka} />;
  const { igralec, sezone, ekipe, statistika: s, imaPodatke, poSezonah } = stat.podatki;
  const moja = igralec.id === jaz.id;

  return (
    <>
      <GlavaStrani
        naslov={moja ? 'Moja statistika' : `Statistika: ${polnoIme(igralec)}`}
        podnaslov="Statistika se izračuna iz zaključenih tekem in izvedenih treningov."
        dejanja={
          <>
            {/* Privzeto je izbrana trenutna sezona; na voljo so tudi pretekle sezone in ekipe (AC 2). */}
            <select value={stat.podatki.sezonaId ?? ''} onChange={(e) => setSezonaId(Number(e.target.value))} aria-label="Sezona" style={{ width: 'auto' }}>
              {!sezone.some((x) => x.id === stat.podatki!.sezonaId) && <option value={stat.podatki.sezonaId ?? ''}>Trenutna sezona</option>}
              {sezone.map((x) => (
                <option key={x.id} value={x.id}>
                  Sezona {x.naziv}
                  {x.status === 'AKTIVNA' ? ' (trenutna)' : ''}
                </option>
              ))}
            </select>
            <select value={ekipaId ?? ''} onChange={(e) => setEkipaId(e.target.value ? Number(e.target.value) : null)} aria-label="Ekipa" style={{ width: 'auto' }}>
              <option value="">Vse ekipe</option>
              {ekipe.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.naziv}
                </option>
              ))}
            </select>
          </>
        }
      />

      {!s || !imaPodatke ? (
        <Obvestilo vrsta="info">Za izbrano sezono ni podatkov.</Obvestilo>
      ) : (
        <div className="mreza-2">
          <Kartica naslov="Tekme">
            <div className="kazalniki">
              {[
                [s.nastopi, 'Nastopi'],
                [s.zacetnePostave, 'V začetni postavi'],
                [s.minute, 'Odigrane minute'],
                [s.goli, 'Goli'],
                [s.asistence, 'Asistence'],
                [s.rumeniKartoni, 'Rumeni kartoni'],
                [s.rdeciKartoni, 'Rdeči kartoni'],
              ].map(([vrednost, oznaka]) => (
                <div className="kazalnik" key={oznaka}>
                  <div className="kazalnik-vrednost">{vrednost}</div>
                  <div className="kazalnik-oznaka">{oznaka}</div>
                </div>
              ))}
            </div>
          </Kartica>
          <Kartica naslov="Treningi">
            <Prisotnost s={s} />
          </Kartica>
        </div>
      )}

      {poSezonah.length > 0 && (
        <Kartica naslov="Po sezonah">
          <div className="tabela-ovoj">
            <table>
              <thead>
                <tr>
                  <th>Sezona</th>
                  <th className="stevilo">Nastopi</th>
                  <th className="stevilo">Začetne postave</th>
                  <th className="stevilo">Minute</th>
                  <th className="stevilo">Goli</th>
                  <th className="stevilo">Asistence</th>
                  <th>Kartoni</th>
                  <th className="stevilo">Prisotnost</th>
                </tr>
              </thead>
              <tbody>
                {poSezonah.map(({ sezona, statistika: p }) => (
                  <tr key={sezona.id} className="klik" onClick={() => setSezonaId(sezona.id)}>
                    <td>
                      <strong>{sezona.naziv}</strong>
                    </td>
                    <td className="stevilo">{p.nastopi}</td>
                    <td className="stevilo">{p.zacetnePostave}</td>
                    <td className="stevilo">{p.minute}</td>
                    <td className="stevilo">{p.goli}</td>
                    <td className="stevilo">{p.asistence}</td>
                    <td>
                      <Kartoni s={p} />
                    </td>
                    <td className="stevilo">{odstotek(p.prisotnost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Kartica>
      )}
    </>
  );
}
