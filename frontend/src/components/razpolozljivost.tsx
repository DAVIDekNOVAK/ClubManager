import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { danes, datum } from '../format';
import { STATUSI_RAZPOLOZLJIVOSTI, type MojaRazpolozljivost, type StatusNaDan, type StatusRazpolozljivosti } from '../tipi';
import { Kartica, Obvestilo, Polje, Stanje, useNalozi, useOddaja, Znacka } from './ui';

export function ZnackaRazpolozljivosti({ status }: { status: StatusRazpolozljivosti }) {
  const s = STATUSI_RAZPOLOZLJIVOSTI[status];
  return <Znacka barva={s.barva}>{s.naziv}</Znacka>;
}

export function obdobjeStatusa(s: { veljaOd: string | null; veljaDo: string | null }) {
  if (!s.veljaOd) return null;
  return s.veljaDo ? `velja od ${datum(s.veljaOd)} do ${datum(s.veljaDo)}` : `velja od ${datum(s.veljaOd)}`;
}

function TrenutniStatus({ trenutni }: { trenutni: StatusNaDan }) {
  const s = STATUSI_RAZPOLOZLJIVOSTI[trenutni.status];
  return (
    <div className={`status-okvir status-${s.barva}`}>
      <span className="status-pika" />
      <div>
        <strong>{s.naziv}</strong>
        {obdobjeStatusa(trenutni) && <div className="majhno">{obdobjeStatusa(trenutni)}</div>}
      </div>
    </div>
  );
}

/** Kartica »Moja razpoložljivost« na nadzorni plošči (US-16, WF-01). */
export function MojaRazpolozljivostKartica() {
  const razp = useNalozi(() => api.get<MojaRazpolozljivost>('/razpolozljivost/moja'));
  const [status, setStatus] = useState<StatusRazpolozljivosti | ''>('');
  const [veljaOd, setVeljaOd] = useState(danes());
  const [veljaDo, setVeljaDo] = useState('');
  const [uspeh, setUspeh] = useState(false);
  const oddaja = useOddaja();

  async function obOddaji(e: FormEvent) {
    e.preventDefault();
    setUspeh(false);
    const ok = await oddaja.oddaj(() =>
      api.post('/razpolozljivost', { status: status || undefined, veljaOd: veljaOd || undefined, veljaDo: veljaDo || null }),
    );
    if (ok) {
      setUspeh(true);
      setStatus('');
      setVeljaOd(danes());
      setVeljaDo('');
      await razp.osvezi();
    }
  }

  return (
    <Kartica naslov="Moja razpoložljivost">
      <Stanje nalaganje={razp.nalaganje} napaka={razp.napaka} />
      {razp.podatki && <TrenutniStatus trenutni={razp.podatki.trenutni} />}
      {uspeh && <Obvestilo vrsta="uspeh">Status je posodobljen. Trener ga vidi v pregledu razpoložljivosti.</Obvestilo>}
      {oddaja.napaka && <Obvestilo vrsta="napaka">{oddaja.napaka}</Obvestilo>}
      <form className="obrazec" onSubmit={obOddaji} noValidate>
        <Polje oznaka="Nov status" napaka={oddaja.polja.status}>
          <select value={status} onChange={(e) => setStatus(e.target.value as StatusRazpolozljivosti | '')}>
            <option value="">– izberite –</option>
            {Object.entries(STATUSI_RAZPOLOZLJIVOSTI).map(([k, s]) => (
              <option key={k} value={k}>
                {s.naziv}
              </option>
            ))}
          </select>
        </Polje>
        <div className="obrazec-vrsta" style={{ gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)' }}>
          <Polje oznaka="Od" napaka={oddaja.polja.veljaOd}>
            <input type="date" value={veljaOd} min={danes()} onChange={(e) => setVeljaOd(e.target.value)} />
          </Polje>
          <Polje oznaka="Do (neobvezno)" napaka={oddaja.polja.veljaDo}>
            <input type="date" value={veljaDo} min={veljaOd || danes()} onChange={(e) => setVeljaDo(e.target.value)} />
          </Polje>
        </div>
        <div className="vrstica">
          <Link to="/profil">Zgodovina statusov</Link>
          <button className="gumb gumb-glavni" type="submit" disabled={oddaja.posiljanje}>
            Posodobi
          </button>
        </div>
      </form>
    </Kartica>
  );
}

/** Zgodovina razpoložljivosti na profilu igralca (US-16, AC 2). */
export function ZgodovinaRazpolozljivosti() {
  const razp = useNalozi(() => api.get<MojaRazpolozljivost>('/razpolozljivost/moja'));
  return (
    <Kartica naslov="Zgodovina razpoložljivosti" dejanja={razp.podatki && <ZnackaRazpolozljivosti status={razp.podatki.trenutni.status} />}>
      <Stanje nalaganje={razp.nalaganje} napaka={razp.napaka} />
      {razp.podatki && razp.podatki.zgodovina.length === 0 && <p className="tiho">Ni vnesenih statusov – igralec je na voljo.</p>}
      {razp.podatki && razp.podatki.zgodovina.length > 0 && (
        <div className="tabela-ovoj">
          <table>
            <thead>
              <tr>
                <th>Status</th>
                <th>Velja od</th>
                <th>Velja do</th>
              </tr>
            </thead>
            <tbody>
              {razp.podatki.zgodovina.map((z) => (
                <tr key={z.id}>
                  <td>
                    <ZnackaRazpolozljivosti status={z.status} />
                  </td>
                  <td>{datum(z.veljaOd)}</td>
                  <td>{z.veljaDo ? datum(z.veljaDo) : 'do preklica'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Kartica>
  );
}
