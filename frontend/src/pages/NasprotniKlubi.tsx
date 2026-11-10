import { useState, type FormEvent } from 'react';
import { api } from '../api';
import { useAuth } from '../auth';
import { GlavaStrani, izNapake, Kartica, Modal, Obvestilo, Polje, Stanje, useNalozi, useOddaja } from '../components/ui';
import type { NasprotniKlub } from '../tipi';

/** Evidenca nasprotnih klubov (US-10). */
export function NasprotniKlubi() {
  const { imaVlogo } = useAuth();
  const lahkoUreja = imaVlogo('VODJA_EKIPE');
  const klubi = useNalozi(() => api.get<NasprotniKlub[]>('/nasprotni-klubi'));
  const [urejanje, setUrejanje] = useState<NasprotniKlub | null>(null);
  const [sporocilo, setSporocilo] = useState<{ vrsta: 'uspeh' | 'napaka'; besedilo: string } | null>(null);

  async function izbrisi(k: NasprotniKlub) {
    setSporocilo(null);
    try {
      await api.delete(`/nasprotni-klubi/${k.id}`);
      setSporocilo({ vrsta: 'uspeh', besedilo: `Klub ${k.naziv} je izbrisan.` });
      await klubi.osvezi();
    } catch (e) {
      setSporocilo({ vrsta: 'napaka', besedilo: izNapake(e).sporocilo });
    }
  }

  return (
    <>
      <GlavaStrani naslov="Nasprotni klubi" podnaslov="Pri ustvarjanju tekme nasprotnika izberete iz te evidence." />
      {sporocilo && <Obvestilo vrsta={sporocilo.vrsta}>{sporocilo.besedilo}</Obvestilo>}
      <div className="mreza-2">
        <Kartica naslov="Evidenca klubov">
          <Stanje nalaganje={klubi.nalaganje} napaka={klubi.napaka} />
          {klubi.podatki && klubi.podatki.length === 0 && <p className="tiho">V evidenci še ni klubov.</p>}
          {klubi.podatki && klubi.podatki.length > 0 && (
            <div className="tabela-ovoj">
              <table>
                <thead>
                  <tr>
                    <th>Naziv</th>
                    <th>Kraj</th>
                    <th className="stevilo">Tekme</th>
                    {lahkoUreja && <th />}
                  </tr>
                </thead>
                <tbody>
                  {klubi.podatki.map((k) => (
                    <tr key={k.id}>
                      <td>
                        <strong>{k.naziv}</strong>
                      </td>
                      <td>{k.kraj}</td>
                      <td className="stevilo">{k.steviloTekem}</td>
                      {lahkoUreja && (
                        <td className="desno">
                          <span className="dejanja" style={{ justifyContent: 'flex-end' }}>
                            <button className="gumb gumb-majhen" onClick={() => { setUrejanje(k); setSporocilo(null); }}>
                              Uredi
                            </button>
                            {/* Kluba, ki je povezan s tekmo, ni mogoče izbrisati (AC 4). */}
                            <button
                              className="gumb gumb-majhen gumb-nevaren"
                              disabled={k.steviloTekem > 0}
                              title={k.steviloTekem > 0 ? 'Klub je povezan s tekmami, zato ga ni mogoče izbrisati' : undefined}
                              onClick={() => izbrisi(k)}
                            >
                              Izbriši
                            </button>
                          </span>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Kartica>
        {lahkoUreja && (
          <Kartica naslov="Nov klub">
            <ObrazecKluba
              obUspehu={async (k) => {
                setSporocilo({ vrsta: 'uspeh', besedilo: `Klub ${k.naziv} je dodan v evidenco.` });
                await klubi.osvezi();
              }}
            />
          </Kartica>
        )}
      </div>
      {urejanje && (
        <Modal naslov="Urejanje kluba" obZaprtju={() => setUrejanje(null)}>
          <ObrazecKluba
            klub={urejanje}
            obPreklicu={() => setUrejanje(null)}
            obUspehu={async (k) => {
              setUrejanje(null);
              setSporocilo({ vrsta: 'uspeh', besedilo: `Klub ${k.naziv} je posodobljen.` });
              await klubi.osvezi();
            }}
          />
        </Modal>
      )}
    </>
  );
}

export function ObrazecKluba({ klub, obUspehu, obPreklicu }: { klub?: NasprotniKlub; obUspehu: (k: NasprotniKlub) => void; obPreklicu?: () => void }) {
  const [naziv, setNaziv] = useState(klub?.naziv ?? '');
  const [kraj, setKraj] = useState(klub?.kraj ?? '');
  const oddaja = useOddaja();

  async function obOddaji(e: FormEvent) {
    e.preventDefault();
    let shranjen: NasprotniKlub | undefined;
    const ok = await oddaja.oddaj(async () => {
      shranjen = klub
        ? await api.patch<NasprotniKlub>(`/nasprotni-klubi/${klub.id}`, { naziv, kraj })
        : await api.post<NasprotniKlub>('/nasprotni-klubi', { naziv, kraj });
    });
    if (ok && shranjen) {
      if (!klub) {
        setNaziv('');
        setKraj('');
      }
      obUspehu(shranjen);
    }
  }

  return (
    <form className="obrazec" onSubmit={obOddaji} noValidate>
      {oddaja.napaka && <Obvestilo vrsta="napaka">{oddaja.napaka}</Obvestilo>}
      <Polje oznaka="Naziv" napaka={oddaja.polja.naziv} namig="2–80 znakov">
        <input type="text" value={naziv} onChange={(e) => setNaziv(e.target.value)} maxLength={80} />
      </Polje>
      <Polje oznaka="Kraj" napaka={oddaja.polja.kraj}>
        <input type="text" value={kraj} onChange={(e) => setKraj(e.target.value)} maxLength={80} />
      </Polje>
      <div className="dejanja">
        <button className="gumb gumb-glavni" type="submit" disabled={oddaja.posiljanje}>
          {klub ? 'Shrani' : 'Dodaj klub'}
        </button>
        {obPreklicu && (
          <button className="gumb" type="button" onClick={obPreklicu}>
            Prekliči
          </button>
        )}
      </div>
    </form>
  );
}
