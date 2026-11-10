import { Link } from 'react-router-dom';
import { api } from '../api';
import { odstotek, type OsebnaStatistika, type StatistikaIgralca } from '../tipi';
import { Kartica, Stanje, useNalozi } from './ui';

export function Kartoni({ s }: { s: Pick<StatistikaIgralca, 'rumeniKartoni' | 'rdeciKartoni'> }) {
  return (
    <span style={{ whiteSpace: 'nowrap' }}>
      <span className="karton karton-rumen" aria-label="rumeni kartoni" />
      {s.rumeniKartoni}
      <span className="karton karton-rdec" aria-label="rdeči kartoni" style={{ marginLeft: '0.6rem' }} />
      {s.rdeciKartoni}
    </span>
  );
}

export function Prisotnost({ s }: { s: StatistikaIgralca }) {
  return (
    <div>
      <div className="vrstica">
        <span>Prisotnost na treningih</span>
        <strong>{odstotek(s.prisotnost)}</strong>
      </div>
      <div className="napredek" role="progressbar" aria-valuenow={s.prisotnost ?? 0} aria-valuemin={0} aria-valuemax={100}>
        <span style={{ width: `${s.prisotnost ?? 0}%` }} />
      </div>
      <div className="tiho majhno" style={{ marginTop: '0.25rem' }}>
        {s.treningiPrisoten} od {s.treningiIzvedeni} izvedenih treningov
      </div>
    </div>
  );
}

/** Povzetek statistike v trenutni sezoni na nadzorni plošči (WF-01). */
export function MojaSezonaKartica({ igralecId }: { igralecId: number }) {
  const stat = useNalozi(() => api.get<OsebnaStatistika>(`/statistika/igralec/${igralecId}`), [igralecId]);
  const sezona = stat.podatki?.sezone.find((s) => s.id === stat.podatki?.sezonaId);
  const s = stat.podatki?.statistika;

  return (
    <Kartica naslov={`Moja sezona${sezona ? ` ${sezona.naziv}` : ''}`}>
      <Stanje nalaganje={stat.nalaganje} napaka={stat.napaka} />
      {stat.podatki && (!s || !stat.podatki.imaPodatke) && <p className="tiho">Za izbrano sezono ni podatkov.</p>}
      {s && stat.podatki?.imaPodatke && (
        <>
          <div className="kazalniki kazalniki-3" style={{ marginBottom: '0.85rem' }}>
            <div className="kazalnik sredina">
              <div className="kazalnik-vrednost">{s.nastopi}</div>
              <div className="kazalnik-oznaka">Nastopi</div>
            </div>
            <div className="kazalnik sredina">
              <div className="kazalnik-vrednost">{s.goli}</div>
              <div className="kazalnik-oznaka">Goli</div>
            </div>
            <div className="kazalnik sredina">
              <div className="kazalnik-vrednost">{s.asistence}</div>
              <div className="kazalnik-oznaka">Asistence</div>
            </div>
          </div>
          <ul className="seznam">
            <li className="vrstica">
              <span>Odigrane minute</span>
              <strong>{s.minute}</strong>
            </li>
            <li>
              <Prisotnost s={s} />
            </li>
            <li className="vrstica">
              <span>Kartoni</span>
              <Kartoni s={s} />
            </li>
          </ul>
        </>
      )}
      <p style={{ margin: '0.75rem 0 0' }}>
        <Link to="/statistika">Podrobna statistika →</Link>
      </p>
    </Kartica>
  );
}
