import { useState, type FormEvent } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../auth';
import { izNapake, Obvestilo, Polje } from '../components/ui';

export function Prijava() {
  const { uporabnik, nalaganje, prijava } = useAuth();
  const lokacija = useLocation();
  const [ePosta, setEPosta] = useState('');
  const [geslo, setGeslo] = useState('');
  const [napaka, setNapaka] = useState<string | null>(null);
  const [polja, setPolja] = useState<Record<string, string>>({});
  const [posiljanje, setPosiljanje] = useState(false);

  if (nalaganje) return <p className="vsebina tiho">Nalaganje …</p>;
  if (uporabnik) {
    const od = (lokacija.state as { od?: string } | null)?.od;
    return <Navigate to={od && od !== '/prijava' ? od : '/'} replace />;
  }

  async function obOddaji(e: FormEvent) {
    e.preventDefault();
    setPosiljanje(true);
    setNapaka(null);
    setPolja({});
    try {
      await prijava(ePosta, geslo);
    } catch (err) {
      const n = izNapake(err);
      setPolja(n.polja);
      setNapaka(Object.keys(n.polja).length ? null : n.sporocilo);
    } finally {
      setPosiljanje(false);
    }
  }

  return (
    <div className="prijava-ovoj">
      <div className="kartica prijava">
        <h1>⚽ ClubManager</h1>
        <p className="tiho">Prijava v aplikacijo kluba</p>
        {napaka && <Obvestilo vrsta="napaka">{napaka}</Obvestilo>}
        <form className="obrazec" onSubmit={obOddaji} noValidate>
          <Polje oznaka="E-poštni naslov" napaka={polja.ePosta}>
            <input type="email" value={ePosta} onChange={(e) => setEPosta(e.target.value)} autoComplete="username" autoFocus />
          </Polje>
          <Polje oznaka="Geslo" napaka={polja.geslo}>
            <input type="password" value={geslo} onChange={(e) => setGeslo(e.target.value)} autoComplete="current-password" />
          </Polje>
          <button className="gumb gumb-glavni" type="submit" disabled={posiljanje}>
            {posiljanje ? 'Prijavljanje …' : 'Prijava'}
          </button>
        </form>
        <p className="tiho majhno" style={{ marginTop: '1rem', marginBottom: 0 }}>
          Račun dobite s povabilom administratorja kluba.
        </p>
      </div>
    </div>
  );
}
