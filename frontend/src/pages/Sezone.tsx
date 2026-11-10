import { useState, type FormEvent } from 'react';
import { api } from '../api';
import { useUporabnik } from '../auth';
import { GlavaStrani, Kartica, Obvestilo, Polje, Stanje, useNalozi, useOddaja, Znacka } from '../components/ui';
import { datum } from '../format';
import { STATUSI_SEZONE, type Sezona } from '../tipi';

const PRAZNO = { naziv: '', datumZacetka: '', datumKonca: '' };

export function Sezone() {
  const uporabnik = useUporabnik();
  const { podatki: sezone, napaka, nalaganje, osvezi } = useNalozi(() => api.get<Sezona[]>('/sezone'));
  const [obrazec, setObrazec] = useState(PRAZNO);
  const [uspeh, setUspeh] = useState<string | null>(null);
  const oddaja = useOddaja();

  async function obOddaji(e: FormEvent) {
    e.preventDefault();
    setUspeh(null);
    const ok = await oddaja.oddaj(() => api.post('/sezone', obrazec));
    if (ok) {
      setUspeh(`Sezona ${obrazec.naziv} je ustvarjena.`);
      setObrazec(PRAZNO);
      await osvezi();
    }
  }

  const nastavi = (polje: keyof typeof PRAZNO) => (e: { target: { value: string } }) =>
    setObrazec({ ...obrazec, [polje]: e.target.value });

  return (
    <>
      <GlavaStrani naslov="Tekmovalne sezone" podnaslov="Članstva, treningi in tekme so vezani na sezono." />
      <div className="mreza-2">
        <Kartica naslov="Sezone">
          <Stanje nalaganje={nalaganje} napaka={napaka} />
          {sezone && sezone.length === 0 && <p className="tiho">Ni še nobene sezone.</p>}
          {sezone && sezone.length > 0 && (
            <div className="tabela-ovoj">
              <table>
                <thead>
                  <tr>
                    <th>Naziv</th>
                    <th>Začetek</th>
                    <th>Konec</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {sezone.map((s) => (
                    <tr key={s.id}>
                      <td>
                        <strong>{s.naziv}</strong>
                      </td>
                      <td>{datum(s.datumZacetka)}</td>
                      <td>{datum(s.datumKonca)}</td>
                      <td>
                        <Znacka barva={STATUSI_SEZONE[s.status].barva}>{STATUSI_SEZONE[s.status].naziv}</Znacka>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="tiho majhno" style={{ marginTop: '0.75rem', marginBottom: 0 }}>
            Status se spremeni samodejno glede na datum. Podatki zaključenih sezon ostanejo shranjeni in so na voljo v
            statistiki.
          </p>
        </Kartica>

        {uporabnik.jeAdministrator && (
          <Kartica naslov="Nova sezona">
            {uspeh && <Obvestilo vrsta="uspeh">{uspeh}</Obvestilo>}
            {oddaja.napaka && <Obvestilo vrsta="napaka">{oddaja.napaka}</Obvestilo>}
            <form className="obrazec" onSubmit={obOddaji} noValidate>
              <Polje oznaka="Naziv" napaka={oddaja.polja.naziv} namig="npr. 2026/27">
                <input type="text" value={obrazec.naziv} onChange={nastavi('naziv')} maxLength={30} />
              </Polje>
              <Polje oznaka="Datum začetka" napaka={oddaja.polja.datumZacetka}>
                <input type="date" value={obrazec.datumZacetka} onChange={nastavi('datumZacetka')} />
              </Polje>
              <Polje oznaka="Datum konca" napaka={oddaja.polja.datumKonca}>
                <input type="date" value={obrazec.datumKonca} onChange={nastavi('datumKonca')} />
              </Polje>
              <button className="gumb gumb-glavni" type="submit" disabled={oddaja.posiljanje}>
                Ustvari sezono
              </button>
            </form>
          </Kartica>
        )}
      </div>
    </>
  );
}
