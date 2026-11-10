import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import { Obvestilo, Polje, useNalozi, useOddaja } from '../components/ui';
import { VLOGE, type Profil, type Vloga } from '../tipi';

interface PodatkiPovabila {
  ePosta: string;
  vloga: Vloga;
  ekipa: string;
  sezona: string;
}

/** Registracija prek povezave iz povabila (US-19). */
export function Registracija() {
  const { zeton } = useParams();
  const navigate = useNavigate();
  const { nastavi } = useAuth();
  const povabilo = useNalozi(() => api.get<PodatkiPovabila>(`/povabila/zeton/${zeton}`), [zeton]);
  const [obrazec, setObrazec] = useState({ ime: '', priimek: '', geslo: '', gesloPonovno: '' });
  const oddaja = useOddaja();

  const nastaviPolje = (polje: keyof typeof obrazec) => (e: { target: { value: string } }) =>
    setObrazec({ ...obrazec, [polje]: e.target.value });

  async function obOddaji(e: FormEvent) {
    e.preventDefault();
    const ok = await oddaja.oddaj(async () => {
      const profil = await api.post<Profil>(`/povabila/zeton/${zeton}/sprejmi`, obrazec);
      // Strežnik je ob registraciji že ustvaril sejo, zato uporabnika samo še preusmerimo.
      nastavi(profil);
    });
    if (ok) navigate('/', { replace: true });
  }

  return (
    <div className="prijava-ovoj">
      <div className="kartica prijava">
        <h1>⚽ ClubManager</h1>
        {povabilo.nalaganje && <p className="tiho">Nalaganje …</p>}
        {povabilo.napaka && (
          <>
            <Obvestilo vrsta="napaka">{povabilo.napaka}</Obvestilo>
            <p style={{ marginBottom: 0 }}>
              <Link to="/prijava">Na prijavo</Link>
            </p>
          </>
        )}
        {povabilo.podatki && (
          <>
            <p className="tiho">
              Povabljeni ste kot <strong>{VLOGE[povabilo.podatki.vloga].toLowerCase()}</strong> ekipe{' '}
              <strong>{povabilo.podatki.ekipa}</strong> (sezona {povabilo.podatki.sezona}). Za dostop ustvarite račun.
            </p>
            {oddaja.napaka && <Obvestilo vrsta="napaka">{oddaja.napaka}</Obvestilo>}
            <form className="obrazec" onSubmit={obOddaji} noValidate>
              <Polje oznaka="E-poštni naslov" namig="Naslov iz povabila, ni ga mogoče spremeniti.">
                <input type="email" value={povabilo.podatki.ePosta} disabled readOnly autoComplete="username" />
              </Polje>
              <div className="obrazec-vrsta">
                <Polje oznaka="Ime" napaka={oddaja.polja.ime}>
                  <input type="text" value={obrazec.ime} onChange={nastaviPolje('ime')} autoComplete="given-name" autoFocus />
                </Polje>
                <Polje oznaka="Priimek" napaka={oddaja.polja.priimek}>
                  <input type="text" value={obrazec.priimek} onChange={nastaviPolje('priimek')} autoComplete="family-name" />
                </Polje>
              </div>
              <Polje oznaka="Geslo" napaka={oddaja.polja.geslo} namig="Vsaj 8 znakov, vsaj ena črka in ena številka.">
                <input type="password" value={obrazec.geslo} onChange={nastaviPolje('geslo')} autoComplete="new-password" />
              </Polje>
              <Polje oznaka="Ponovi geslo" napaka={oddaja.polja.gesloPonovno}>
                <input type="password" value={obrazec.gesloPonovno} onChange={nastaviPolje('gesloPonovno')} autoComplete="new-password" />
              </Polje>
              <button className="gumb gumb-glavni" type="submit" disabled={oddaja.posiljanje}>
                Ustvari račun
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
