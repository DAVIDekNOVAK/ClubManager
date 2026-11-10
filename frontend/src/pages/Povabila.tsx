import { useState, type FormEvent } from 'react';
import { api } from '../api';
import { useSezone } from '../components/sezone';
import { GlavaStrani, izNapake, Kartica, Obvestilo, Polje, Stanje, useNalozi, useOddaja, Znacka } from '../components/ui';
import { datumUra } from '../format';
import { STATUSI_POVABILA, VLOGE, type Ekipa, type Povabilo, type Vloga } from '../tipi';

export function Povabila() {
  const povabila = useNalozi(() => api.get<Povabilo[]>('/povabila'));
  const ekipe = useNalozi(() => api.get<Ekipa[]>('/ekipe'));
  const { sezone, sezonaId, setSezonaId } = useSezone();
  const [ePosta, setEPosta] = useState('');
  const [ekipaId, setEkipaId] = useState('');
  const [vloga, setVloga] = useState<Vloga>('IGRALEC');
  const [sporocilo, setSporocilo] = useState<{ vrsta: 'uspeh' | 'napaka'; besedilo: string } | null>(null);
  const oddaja = useOddaja();

  async function obOddaji(e: FormEvent) {
    e.preventDefault();
    setSporocilo(null);
    const ok = await oddaja.oddaj(() =>
      api.post('/povabila', { ePosta, ekipaId: ekipaId || undefined, sezonaId: sezonaId ?? undefined, vloga }),
    );
    if (ok) {
      setSporocilo({ vrsta: 'uspeh', besedilo: `Povabilo je poslano na ${ePosta.trim()}.` });
      setEPosta('');
      await povabila.osvezi();
    }
  }

  async function ponovi(p: Povabilo) {
    setSporocilo(null);
    try {
      await api.post(`/povabila/${p.id}/ponovi`);
      setSporocilo({ vrsta: 'uspeh', besedilo: `Povabilo je znova poslano na ${p.ePosta}.` });
      await povabila.osvezi();
    } catch (e) {
      setSporocilo({ vrsta: 'napaka', besedilo: izNapake(e).sporocilo });
    }
  }

  return (
    <>
      <GlavaStrani naslov="Povabila" podnaslov="Novi člani se v aplikacijo registrirajo prek povezave v e-pošti." />
      {sporocilo && <Obvestilo vrsta={sporocilo.vrsta}>{sporocilo.besedilo}</Obvestilo>}
      <div className="mreza-2">
        <Kartica naslov="Poslana povabila">
          <Stanje nalaganje={povabila.nalaganje} napaka={povabila.napaka} />
          {povabila.podatki && povabila.podatki.length === 0 && <p className="tiho">Ni še nobenega povabila.</p>}
          {povabila.podatki && povabila.podatki.length > 0 && (
            <div className="tabela-ovoj">
              <table>
                <thead>
                  <tr>
                    <th>E-pošta</th>
                    <th>Ekipa in vloga</th>
                    <th>Poslano</th>
                    <th>Status</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {povabila.podatki.map((p) => (
                    <tr key={p.id}>
                      <td>{p.ePosta}</td>
                      <td>
                        {p.ekipa.naziv} · {VLOGE[p.vloga]}
                        <div className="tiho majhno">sezona {p.sezona.naziv}</div>
                      </td>
                      <td>
                        {datumUra(p.poslanoOb)}
                        {p.status === 'POSLANO' && <div className="tiho majhno">velja do {datumUra(p.datumPoteka)}</div>}
                      </td>
                      <td>
                        <Znacka barva={STATUSI_POVABILA[p.status].barva}>{STATUSI_POVABILA[p.status].naziv}</Znacka>
                      </td>
                      <td className="desno">
                        {p.status === 'POTEKLO' && (
                          <button className="gumb gumb-majhen" onClick={() => ponovi(p)}>
                            Pošlji znova
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Kartica>

        <Kartica naslov="Novo povabilo">
          {oddaja.napaka && <Obvestilo vrsta="napaka">{oddaja.napaka}</Obvestilo>}
          <form className="obrazec" onSubmit={obOddaji} noValidate>
            <Polje oznaka="E-poštni naslov" napaka={oddaja.polja.ePosta}>
              <input type="email" value={ePosta} onChange={(e) => setEPosta(e.target.value)} />
            </Polje>
            <Polje oznaka="Ekipa" napaka={oddaja.polja.ekipaId}>
              <select value={ekipaId} onChange={(e) => setEkipaId(e.target.value)}>
                <option value="">– izberite –</option>
                {ekipe.podatki?.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.naziv}
                  </option>
                ))}
              </select>
            </Polje>
            <Polje oznaka="Sezona" napaka={oddaja.polja.sezonaId}>
              <select value={sezonaId ?? ''} onChange={(e) => setSezonaId(Number(e.target.value))}>
                {sezone.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.naziv}
                  </option>
                ))}
              </select>
            </Polje>
            <Polje oznaka="Vloga" napaka={oddaja.polja.vloga}>
              <select value={vloga} onChange={(e) => setVloga(e.target.value as Vloga)}>
                {Object.entries(VLOGE).map(([k, ime]) => (
                  <option key={k} value={k}>
                    {ime}
                  </option>
                ))}
              </select>
            </Polje>
            <button className="gumb gumb-glavni" type="submit" disabled={oddaja.posiljanje}>
              {oddaja.posiljanje ? 'Pošiljanje …' : 'Pošlji povabilo'}
            </button>
          </form>
          <p className="tiho majhno" style={{ marginTop: '0.75rem', marginBottom: 0 }}>
            Povezava v povabilu je enkratna in velja 7 dni.
          </p>
        </Kartica>
      </div>
    </>
  );
}
