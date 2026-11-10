import { useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api';
import { useAuth, useUporabnik } from '../auth';
import { ZnackaRazpolozljivosti } from '../components/razpolozljivost';
import { IzbiraSezone, useSezone } from '../components/sezone';
import { GlavaStrani, Kartica, Modal, Obvestilo, Polje, Stanje, useNalozi, useOddaja, Znacka } from '../components/ui';
import { danes, datum, zaVnosDatuma } from '../format';
import { KATEGORIJE, polnoIme, VLOGE, type ClanEkipe, type EkipaPodrobno, type RazpolozljivostEkipe, type Sezona, type UporabnikKratko, type Vloga } from '../tipi';

export function EkipaPodrobnosti() {
  const ekipaId = Number(useParams().id);
  const uporabnik = useUporabnik();
  const { osvezi: osveziProfil } = useAuth();
  const { sezone, sezonaId, setSezonaId } = useSezone();
  const ekipa = useNalozi(() => api.get<EkipaPodrobno>(`/ekipe/${ekipaId}`), [ekipaId]);
  const clani = useNalozi(
    () => (sezonaId ? api.get<ClanEkipe[]>(`/ekipe/${ekipaId}/clanstva?sezonaId=${sezonaId}`) : Promise.resolve([])),
    [ekipaId, sezonaId],
  );
  // Trener in administrator pri igralcih vidita današnji status razpoložljivosti.
  const vidiRazpolozljivost = uporabnik.jeAdministrator || !!ekipa.podatki?.mojeVloge.includes('TRENER');
  const razpolozljivost = useNalozi(
    () => (vidiRazpolozljivost ? api.get<RazpolozljivostEkipe>(`/ekipe/${ekipaId}/razpolozljivost`) : Promise.resolve(null)),
    [ekipaId, vidiRazpolozljivost],
  );
  const statusIgralca = new Map(razpolozljivost.podatki?.igralci.map((i) => [i.igralecId, i.status]));
  const [dodajanje, setDodajanje] = useState(false);
  const [urejanje, setUrejanje] = useState<ClanEkipe | null>(null);
  const [uspeh, setUspeh] = useState<string | null>(null);
  const [potrditevArhiva, setPotrditevArhiva] = useState(false);
  const arhiv = useOddaja();
  const jeAdmin = uporabnik.jeAdministrator;

  async function spremeniArhiv(arhiviraj: boolean) {
    setUspeh(null);
    const ok = await arhiv.oddaj(() => api.post(`/ekipe/${ekipaId}/${arhiviraj ? 'arhiviraj' : 'aktiviraj'}`));
    setPotrditevArhiva(false);
    if (ok) {
      setUspeh(arhiviraj ? 'Ekipa je arhivirana. Zgodovinski podatki ostanejo shranjeni.' : 'Ekipa je ponovno aktivna.');
      await Promise.all([ekipa.osvezi(), osveziProfil()]);
    }
  }

  async function poSpremembi(sporocilo: string) {
    setDodajanje(false);
    setUrejanje(null);
    setUspeh(sporocilo);
    await Promise.all([clani.osvezi(), osveziProfil()]);
  }

  if (!ekipa.podatki) return <Stanje nalaganje={ekipa.nalaganje} napaka={ekipa.napaka} />;
  const e = ekipa.podatki;

  return (
    <>
      <GlavaStrani
        naslov={
          <>
            {e.naziv} {e.jeArhivirana && <Znacka>Arhivirana</Znacka>}
          </>
        }
        podnaslov={
          <>
            <Link to="/ekipe">Ekipe</Link> · kategorija {KATEGORIJE[e.kategorija]}
            {e.mojeVloge.length > 0 && <> · moja vloga: {e.mojeVloge.map((v) => VLOGE[v]).join(', ')}</>}
          </>
        }
        dejanja={
          <>
            <IzbiraSezone sezone={sezone} vrednost={sezonaId} obSpremembi={setSezonaId} />
            {jeAdmin && !e.jeArhivirana && (
              <button className="gumb gumb-nevaren" onClick={() => setPotrditevArhiva(true)}>
                Arhiviraj
              </button>
            )}
            {jeAdmin && e.jeArhivirana && (
              <button className="gumb" onClick={() => spremeniArhiv(false)} disabled={arhiv.posiljanje}>
                Ponovno aktiviraj
              </button>
            )}
          </>
        }
      />
      {uspeh && <Obvestilo vrsta="uspeh">{uspeh}</Obvestilo>}
      {arhiv.napaka && <Obvestilo vrsta="napaka">{arhiv.napaka}</Obvestilo>}
      {(arhiv.polja.naziv) && <Obvestilo vrsta="napaka">{arhiv.polja.naziv}</Obvestilo>}
      {e.jeArhivirana && (
        <Obvestilo vrsta="info">
          Ekipa je arhivirana. Novih treningov in tekem zanjo ni mogoče ustvariti, zgodovinski podatki pa ostanejo vidni.
        </Obvestilo>
      )}
      {potrditevArhiva && (
        <Modal naslov="Arhiviranje ekipe" obZaprtju={() => setPotrditevArhiva(false)}>
          <p>Ali res želite arhivirati ekipo {e.naziv}?</p>
          <p className="tiho majhno">Treningi, tekme, evidence prisotnosti in statistika ekipe ostanejo shranjeni.</p>
          <div className="dejanja">
            <button className="gumb gumb-nevaren" onClick={() => spremeniArhiv(true)} disabled={arhiv.posiljanje}>
              Arhiviraj ekipo
            </button>
            <button className="gumb" onClick={() => setPotrditevArhiva(false)}>
              Prekliči
            </button>
          </div>
        </Modal>
      )}

      <Kartica
        naslov="Člani ekipe"
        dejanja={
          jeAdmin &&
          !e.jeArhivirana && (
            <button className="gumb gumb-glavni gumb-majhen" onClick={() => { setDodajanje(true); setUspeh(null); }}>
              Dodaj člana
            </button>
          )
        }
      >
        <Stanje nalaganje={clani.nalaganje} napaka={clani.napaka} />
        {clani.podatki && clani.podatki.length === 0 && <p className="tiho">V izbrani sezoni ekipa nima članov.</p>}
        {clani.podatki && clani.podatki.length > 0 && (
          <div className="tabela-ovoj">
            <table>
              <thead>
                <tr>
                  <th>Član</th>
                  <th>Vloge</th>
                  {vidiRazpolozljivost && <th>Razpoložljivost danes</th>}
                  <th>Pridružitev</th>
                  <th>Odhod</th>
                  {jeAdmin && <th />}
                </tr>
              </thead>
              <tbody>
                {clani.podatki.map((c) => (
                  <tr key={c.id}>
                    <td>
                      {jeAdmin ? (
                        <Link to={`/uporabniki/${c.uporabnik.id}`}>{polnoIme(c.uporabnik)}</Link>
                      ) : (
                        polnoIme(c.uporabnik)
                      )}
                      {c.uporabnik.ePosta && <div className="tiho majhno">{c.uporabnik.ePosta}</div>}
                    </td>
                    <td>
                      <span className="dejanja">
                        {c.vloge.map((v) => (
                          <Znacka key={v} barva={v === 'IGRALEC' ? 'zelena' : 'modra'}>
                            {VLOGE[v]}
                          </Znacka>
                        ))}
                      </span>
                    </td>
                    {vidiRazpolozljivost && (
                      <td>{statusIgralca.has(c.uporabnik.id) ? <ZnackaRazpolozljivosti status={statusIgralca.get(c.uporabnik.id)!} /> : '–'}</td>
                    )}
                    <td>{datum(c.datumPridruzitve)}</td>
                    <td>{c.datumOdhoda ? <>{datum(c.datumOdhoda)} {c.jeOdsel && <Znacka>Odšel</Znacka>}</> : '–'}</td>
                    {jeAdmin && (
                      <td className="desno">
                        <button className="gumb gumb-majhen" onClick={() => { setUrejanje(c); setUspeh(null); }}>
                          Uredi
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Kartica>

      {dodajanje && sezonaId && (
        <DodajClana
          ekipaId={ekipaId}
          sezone={sezone}
          privzetaSezonaId={sezonaId}
          obstojeci={clani.podatki ?? []}
          obZaprtju={() => setDodajanje(false)}
          obUspehu={(ime, izbranaSezonaId) => {
            setSezonaId(izbranaSezonaId);
            return poSpremembi(`${ime} je dodan v ekipo.`);
          }}
        />
      )}
      {urejanje && (
        <UrediClanstvo
          clan={urejanje}
          obZaprtju={() => setUrejanje(null)}
          obUspehu={() => poSpremembi(`Članstvo uporabnika ${polnoIme(urejanje.uporabnik)} je posodobljeno.`)}
        />
      )}
    </>
  );
}

const VSE_VLOGE: Vloga[] = ['IGRALEC', 'TRENER', 'VODJA_EKIPE'];

function IzbiraVlog({ vloge, obSpremembi }: { vloge: Vloga[]; obSpremembi: (v: Vloga[]) => void }) {
  return (
    <div className="izbire">
      {VSE_VLOGE.map((v) => (
        <label key={v} className="izbira">
          <input
            type="checkbox"
            checked={vloge.includes(v)}
            onChange={(e) => obSpremembi(e.target.checked ? [...vloge, v] : vloge.filter((x) => x !== v))}
          />
          {VLOGE[v]}
        </label>
      ))}
    </div>
  );
}

function DodajClana({
  ekipaId, sezone, privzetaSezonaId, obstojeci, obZaprtju, obUspehu,
}: {
  ekipaId: number;
  sezone: Sezona[];
  privzetaSezonaId: number;
  obstojeci: ClanEkipe[];
  obZaprtju: () => void;
  obUspehu: (ime: string, sezonaId: number) => void;
}) {
  const uporabniki = useNalozi(() => api.get<UporabnikKratko[]>('/uporabniki'));
  const [uporabnikId, setUporabnikId] = useState('');
  const [sezonaId, setSezonaId] = useState(privzetaSezonaId);
  const [vloge, setVloge] = useState<Vloga[]>(['IGRALEC']);
  const [datumPridruzitve, setDatumPridruzitve] = useState(danes());
  const oddaja = useOddaja();

  async function obOddaji(e: FormEvent) {
    e.preventDefault();
    const ok = await oddaja.oddaj(() =>
      api.post('/clanstva', { uporabnikId: uporabnikId || undefined, ekipaId, sezonaId, vloge, datumPridruzitve: datumPridruzitve || undefined }),
    );
    const izbran = uporabniki.podatki?.find((u) => u.id === Number(uporabnikId));
    if (ok) obUspehu(izbran ? polnoIme(izbran) : 'Uporabnik', sezonaId);
  }

  const zeClani = new Set(sezonaId === privzetaSezonaId ? obstojeci.map((c) => c.uporabnik.id) : []);

  return (
    <Modal naslov="Dodaj člana" obZaprtju={obZaprtju}>
      {oddaja.napaka && <Obvestilo vrsta="napaka">{oddaja.napaka}</Obvestilo>}
      <form className="obrazec" onSubmit={obOddaji} noValidate>
        <Polje oznaka="Uporabnik" napaka={oddaja.polja.uporabnikId}>
          <select value={uporabnikId} onChange={(e) => setUporabnikId(e.target.value)} autoFocus>
            <option value="">– izberite –</option>
            {uporabniki.podatki?.map((u) => (
              <option key={u.id} value={u.id}>
                {u.priimek} {u.ime} ({u.ePosta}){zeClani.has(u.id) ? ' – že član' : ''}
              </option>
            ))}
          </select>
        </Polje>
        <Polje oznaka="Sezona" napaka={oddaja.polja.sezonaId}>
          <select value={sezonaId} onChange={(e) => setSezonaId(Number(e.target.value))}>
            {sezone.map((s) => (
              <option key={s.id} value={s.id}>
                {s.naziv}
              </option>
            ))}
          </select>
        </Polje>
        <Polje oznaka="Vloge" napaka={oddaja.polja.vloge}>
          <IzbiraVlog vloge={vloge} obSpremembi={setVloge} />
        </Polje>
        <Polje oznaka="Datum pridružitve" napaka={oddaja.polja.datumPridruzitve}>
          <input type="date" value={datumPridruzitve} onChange={(e) => setDatumPridruzitve(e.target.value)} />
        </Polje>
        <div className="dejanja">
          <button className="gumb gumb-glavni" type="submit" disabled={oddaja.posiljanje}>
            Dodaj v ekipo
          </button>
          <button className="gumb" type="button" onClick={obZaprtju}>
            Prekliči
          </button>
        </div>
      </form>
    </Modal>
  );
}

function UrediClanstvo({ clan, obZaprtju, obUspehu }: { clan: ClanEkipe; obZaprtju: () => void; obUspehu: () => void }) {
  const [vloge, setVloge] = useState<Vloga[]>(clan.vloge);
  const [datumOdhoda, setDatumOdhoda] = useState(zaVnosDatuma(clan.datumOdhoda));
  const oddaja = useOddaja();

  async function obOddaji(e: FormEvent) {
    e.preventDefault();
    const ok = await oddaja.oddaj(() => api.patch(`/clanstva/${clan.id}`, { vloge, datumOdhoda: datumOdhoda || null }));
    if (ok) obUspehu();
  }

  return (
    <Modal naslov={`Članstvo: ${polnoIme(clan.uporabnik)}`} obZaprtju={obZaprtju}>
      {oddaja.napaka && <Obvestilo vrsta="napaka">{oddaja.napaka}</Obvestilo>}
      <form className="obrazec" onSubmit={obOddaji} noValidate>
        <Polje oznaka="Vloge" napaka={oddaja.polja.vloge}>
          <IzbiraVlog vloge={vloge} obSpremembi={setVloge} />
        </Polje>
        <Polje
          oznaka="Datum odhoda"
          napaka={oddaja.polja.datumOdhoda}
          namig="Članstvo se ne izbriše. Po tem datumu član ne vidi več prihodnjih aktivnosti ekipe, pretekli podatki pa ostanejo v statistiki."
        >
          <input type="date" value={datumOdhoda} onChange={(e) => setDatumOdhoda(e.target.value)} />
        </Polje>
        <div className="dejanja">
          <button className="gumb gumb-glavni" type="submit" disabled={oddaja.posiljanje}>
            Shrani
          </button>
          <button className="gumb" type="button" onClick={obZaprtju}>
            Prekliči
          </button>
        </div>
      </form>
    </Modal>
  );
}
