import { useState, type FormEvent } from 'react';
import { api } from '../api';
import { useUporabnik } from '../auth';
import { GlavaStrani, Kartica, Obvestilo, Polje, Stanje, useNalozi, useOddaja, Znacka } from '../components/ui';
import { KATEGORIJE, type Ekipa, type Kategorija } from '../tipi';

export function Ekipe() {
  const uporabnik = useUporabnik();
  const { podatki: ekipe, napaka, nalaganje, osvezi } = useNalozi(() => api.get<Ekipa[]>('/ekipe'));
  const [obrazecOdprt, setObrazecOdprt] = useState(false);
  const [uspeh, setUspeh] = useState<string | null>(null);

  return (
    <>
      <GlavaStrani
        naslov="Ekipe"
        podnaslov={uporabnik.jeAdministrator ? 'Vse ekipe kluba' : 'Ekipe, v katerih ste član'}
        dejanja={
          // Gumb je prikazan samo administratorju (US-02, AC 4).
          uporabnik.jeAdministrator &&
          !obrazecOdprt && (
            <button className="gumb gumb-glavni" onClick={() => { setObrazecOdprt(true); setUspeh(null); }}>
              Nova ekipa
            </button>
          )
        }
      />
      {uspeh && <Obvestilo vrsta="uspeh">{uspeh}</Obvestilo>}
      {obrazecOdprt && (
        <NovaEkipa
          obPreklicu={() => setObrazecOdprt(false)}
          obUspehu={async (naziv) => {
            setObrazecOdprt(false);
            setUspeh(`Ekipa ${naziv} je ustvarjena.`);
            await osvezi();
          }}
        />
      )}
      <Kartica>
        <Stanje nalaganje={nalaganje} napaka={napaka} />
        {ekipe && ekipe.length === 0 && <p className="tiho">Ni ekip za prikaz.</p>}
        {ekipe && ekipe.length > 0 && (
          <div className="tabela-ovoj">
            <table>
              <thead>
                <tr>
                  <th>Naziv</th>
                  <th>Kategorija</th>
                  <th className="stevilo">Člani</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {ekipe.map((e) => (
                  <tr key={e.id}>
                    <td>
                      <strong>{e.naziv}</strong>
                    </td>
                    <td>{KATEGORIJE[e.kategorija]}</td>
                    <td className="stevilo">{e.steviloClanov}</td>
                    <td>{e.jeArhivirana ? <Znacka>Arhivirana</Znacka> : <Znacka barva="zelena">Aktivna</Znacka>}</td>
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

function NovaEkipa({ obPreklicu, obUspehu }: { obPreklicu: () => void; obUspehu: (naziv: string) => void }) {
  const [naziv, setNaziv] = useState('');
  const [kategorija, setKategorija] = useState<Kategorija | ''>('');
  const oddaja = useOddaja();

  async function obOddaji(e: FormEvent) {
    e.preventDefault();
    const ok = await oddaja.oddaj(() => api.post('/ekipe', { naziv, kategorija: kategorija || undefined }));
    if (ok) obUspehu(naziv.trim());
  }

  return (
    <Kartica naslov="Nova ekipa">
      {oddaja.napaka && <Obvestilo vrsta="napaka">{oddaja.napaka}</Obvestilo>}
      <form className="obrazec" onSubmit={obOddaji} noValidate>
        <div className="obrazec-vrsta">
          <Polje oznaka="Naziv" napaka={oddaja.polja.naziv} namig="2–50 znakov">
            <input type="text" value={naziv} onChange={(e) => setNaziv(e.target.value)} maxLength={50} autoFocus />
          </Polje>
          <Polje oznaka="Kategorija" napaka={oddaja.polja.kategorija}>
            <select value={kategorija} onChange={(e) => setKategorija(e.target.value as Kategorija | '')}>
              <option value="">– izberite –</option>
              {Object.entries(KATEGORIJE).map(([k, ime]) => (
                <option key={k} value={k}>
                  {ime}
                </option>
              ))}
            </select>
          </Polje>
        </div>
        <div className="dejanja">
          <button className="gumb gumb-glavni" type="submit" disabled={oddaja.posiljanje}>
            Shrani ekipo
          </button>
          <button className="gumb" type="button" onClick={obPreklicu}>
            Prekliči
          </button>
        </div>
      </form>
    </Kartica>
  );
}
