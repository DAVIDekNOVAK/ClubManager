import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { danes, datumUra, lokalniDeli, ura, vIso } from '../format';
import { RAZLOGI_ODSOTNOSTI, STATUSI_TRENINGA, type RazlogOdsotnosti, type Trening } from '../tipi';
import { Obvestilo, Polje, useOddaja, Znacka } from './ui';

/** Termin treninga: »sre., 12. 11. 2026, 18:00–19:30«. */
export const terminTreninga = (t: Pick<Trening, 'zacetek' | 'konec'>) => `${datumUra(t.zacetek)}–${ura(t.konec)}`;

export function ZnackaTreninga({ trening }: { trening: Trening }) {
  return (
    <span className="dejanja">
      <Znacka barva={STATUSI_TRENINGA[trening.status].barva}>{STATUSI_TRENINGA[trening.status].naziv}</Znacka>
      {trening.jeSpremenjen && <Znacka barva="rumena">Spremenjeno</Znacka>}
    </span>
  );
}

const MAX_VSEBINA = 500;

/**
 * Obrazec za nov trening (US-05) ali spremembo obstoječega (US-06).
 * Pri novem treningu trener izbere ekipo med ekipami, v katerih ima vlogo trenerja.
 */
export function ObrazecTreninga({
  ekipe, trening, obUspehu, obPreklicu,
}: {
  ekipe?: { id: number; naziv: string }[];
  trening?: Trening;
  obUspehu: (t: Trening) => void;
  obPreklicu: () => void;
}) {
  const zacetni = trening ? lokalniDeli(trening.zacetek) : { datum: danes(), ura: '18:00' };
  const [ekipaId, setEkipaId] = useState(ekipe?.length === 1 ? String(ekipe[0].id) : '');
  const [datum, setDatum] = useState(zacetni.datum);
  const [uraZacetka, setUraZacetka] = useState(zacetni.ura);
  const [uraKonca, setUraKonca] = useState(trening ? lokalniDeli(trening.konec).ura : '19:30');
  const [lokacija, setLokacija] = useState(trening?.lokacija ?? '');
  const [vsebina, setVsebina] = useState(trening?.vsebina ?? '');
  const oddaja = useOddaja();

  async function obOddaji(e: FormEvent) {
    e.preventDefault();
    const telo = {
      ekipaId: ekipaId || undefined,
      zacetek: datum && uraZacetka ? vIso(datum, uraZacetka) : undefined,
      konec: datum && uraKonca ? vIso(datum, uraKonca) : undefined,
      lokacija,
      vsebina,
    };
    let shranjen: Trening | undefined;
    const ok = await oddaja.oddaj(async () => {
      shranjen = trening ? await api.patch<Trening>(`/treningi/${trening.id}`, telo) : await api.post<Trening>('/treningi', telo);
    });
    if (ok && shranjen) obUspehu(shranjen);
  }

  return (
    <form className="obrazec" onSubmit={obOddaji} noValidate>
      {oddaja.napaka && <Obvestilo vrsta="napaka">{oddaja.napaka}</Obvestilo>}
      {ekipe && (
        <Polje oznaka="Ekipa" napaka={oddaja.polja.ekipaId}>
          <select value={ekipaId} onChange={(e) => setEkipaId(e.target.value)}>
            {ekipe.length !== 1 && <option value="">– izberite –</option>}
            {ekipe.map((e) => (
              <option key={e.id} value={e.id}>
                {e.naziv}
              </option>
            ))}
          </select>
        </Polje>
      )}
      <div className="obrazec-vrsta">
        <Polje oznaka="Datum" napaka={oddaja.polja.zacetek}>
          <input type="date" value={datum} min={danes()} onChange={(e) => setDatum(e.target.value)} />
        </Polje>
        <Polje oznaka="Ura začetka">
          <input type="time" value={uraZacetka} onChange={(e) => setUraZacetka(e.target.value)} />
        </Polje>
        <Polje oznaka="Ura konca" napaka={oddaja.polja.konec}>
          <input type="time" value={uraKonca} onChange={(e) => setUraKonca(e.target.value)} />
        </Polje>
      </div>
      <Polje oznaka="Lokacija" napaka={oddaja.polja.lokacija}>
        <input type="text" value={lokacija} onChange={(e) => setLokacija(e.target.value)} maxLength={100} />
      </Polje>
      <Polje oznaka="Vsebina treninga (neobvezno)" napaka={oddaja.polja.vsebina} namig={`${vsebina.length}/${MAX_VSEBINA} znakov`}>
        <textarea value={vsebina} onChange={(e) => setVsebina(e.target.value)} maxLength={MAX_VSEBINA} rows={3} />
      </Polje>
      <div className="dejanja">
        <button className="gumb gumb-glavni" type="submit" disabled={oddaja.posiljanje}>
          {trening ? 'Shrani spremembe' : 'Ustvari trening'}
        </button>
        <button className="gumb" type="button" onClick={obPreklicu}>
          Prekliči
        </button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Kartica treninga na nadzorni plošči s potrjevanjem udeležbe (US-07, WF-01)
// ---------------------------------------------------------------------------

const mesecFmt = new Intl.DateTimeFormat('sl-SI', { month: 'short' });

export function DatumAktivnosti({ datum, tekma = false }: { datum: string; tekma?: boolean }) {
  const d = new Date(datum);
  return (
    <div className={`aktivnost-datum${tekma ? ' tekma' : ''}`}>
      <span className="dan">{d.getDate()}</span>
      <span className="mesec">{mesecFmt.format(d).replace('.', '')}</span>
    </div>
  );
}

export function KarticaTreninga({ trening: t, uporabnikId, obSpremembi }: { trening: Trening; uporabnikId: number; obSpremembi: () => void }) {
  const [odsotnost, setOdsotnost] = useState(false);
  const [razlog, setRazlog] = useState<RazlogOdsotnosti | ''>(t.mojaPrisotnost?.razlogOdsotnosti ?? '');
  const [komentar, setKomentar] = useState(t.mojaPrisotnost?.komentar ?? '');
  const oddaja = useOddaja();
  const odpovedan = t.status === 'ODPOVEDAN';
  const prijava = t.mojaPrisotnost?.prijavljenaPrisotnost;
  // Po začetku treninga odgovora ni več mogoče spremeniti (US-07, AC 3).
  const zaklenjeno = t.seJeZacel || t.status !== 'NACRTOVAN';

  async function poslji(telo: { odgovor: 'PRIDE' | 'NE_PRIDE'; razlog?: string; komentar?: string }) {
    const ok = await oddaja.oddaj(() => api.put(`/treningi/${t.id}/udelezba/${uporabnikId}`, telo));
    if (ok) {
      setOdsotnost(false);
      obSpremembi();
    }
  }

  return (
    <li className={`aktivnost${odpovedan ? ' aktivnost-odpovedana' : ''}`}>
      <DatumAktivnosti datum={t.zacetek} />
      <div className="aktivnost-telo">
        <div className="vrstica">
          <div className="aktivnost-glava">
            <Znacka barva="zelena">Trening</Znacka>
            <Link to={`/treningi/${t.id}`} className={odpovedan ? 'precrtano' : undefined}>
              <strong>{t.ekipa.naziv}</strong>
            </Link>
            {t.jeSpremenjen && <Znacka barva="rumena">Spremenjeno</Znacka>}
            {odpovedan && <Znacka barva="rdeca">Odpovedan</Znacka>}
          </div>
          {t.mojaPrisotnost && !odpovedan && (
            <div className="dejanja">
              <button
                className={`gumb${prijava === 'PRIDE' ? ' gumb-glavni' : ''}`}
                aria-pressed={prijava === 'PRIDE'}
                disabled={zaklenjeno || oddaja.posiljanje}
                onClick={() => poslji({ odgovor: 'PRIDE' })}
              >
                {prijava === 'PRIDE' ? '✓ ' : ''}Pridem
              </button>
              <button
                className={`gumb gumb-nevaren${prijava === 'NE_PRIDE' ? ' gumb-izbran' : ''}`}
                aria-pressed={prijava === 'NE_PRIDE'}
                disabled={zaklenjeno || oddaja.posiljanje}
                onClick={() => setOdsotnost(true)}
              >
                {prijava === 'NE_PRIDE' ? '✗ ' : ''}Ne pridem
              </button>
            </div>
          )}
        </div>
        <p className={odpovedan ? 'precrtano' : undefined}>
          {terminTreninga(t)} · {t.lokacija}
        </p>
        {t.vsebina && !odpovedan && <p className="tiho majhno">{t.vsebina}</p>}
        {prijava === 'NE_PRIDE' && t.mojaPrisotnost?.razlogOdsotnosti && !odsotnost && (
          <p className="tiho majhno">
            Razlog odsotnosti: {RAZLOGI_ODSOTNOSTI[t.mojaPrisotnost.razlogOdsotnosti]}
            {t.mojaPrisotnost.komentar && ` – ${t.mojaPrisotnost.komentar}`}
          </p>
        )}
        {t.povzetek && !odpovedan && (
          <p className="tiho majhno">
            {t.povzetek.pride} pride · {t.povzetek.nePride} odsotnih · {t.povzetek.niOdgovora} brez odgovora
          </p>
        )}
        {zaklenjeno && t.mojaPrisotnost && !odpovedan && <p className="tiho majhno">Trening se je že začel, odgovora ni več mogoče spremeniti.</p>}
        {oddaja.napaka && <Obvestilo vrsta="napaka">{oddaja.napaka}</Obvestilo>}

        {odsotnost && (
          <form
            className="odsotnost obrazec"
            onSubmit={(e) => {
              e.preventDefault();
              void poslji({ odgovor: 'NE_PRIDE', razlog: razlog || undefined, komentar });
            }}
            noValidate
          >
            <div>
              <strong>Ne pridem – trening {datumUra(t.zacetek)}</strong>
              <div className="tiho majhno">Razlog je obvezen, komentar ni.</div>
            </div>
            <div className="obrazec-vrsta">
              <Polje oznaka="Razlog" napaka={oddaja.polja.razlog}>
                <select value={razlog} onChange={(e) => setRazlog(e.target.value as RazlogOdsotnosti | '')} autoFocus>
                  <option value="">– izberite –</option>
                  {Object.entries(RAZLOGI_ODSOTNOSTI).map(([k, ime]) => (
                    <option key={k} value={k}>
                      {ime}
                    </option>
                  ))}
                </select>
              </Polje>
              <Polje oznaka="Komentar (neobvezno)" napaka={oddaja.polja.komentar} namig={`${komentar.length}/200 znakov`}>
                <input type="text" value={komentar} onChange={(e) => setKomentar(e.target.value)} maxLength={200} />
              </Polje>
            </div>
            <div className="dejanja">
              <button className="gumb gumb-nevaren gumb-izbran" type="submit" disabled={oddaja.posiljanje}>
                Potrdi odsotnost
              </button>
              <button className="gumb" type="button" onClick={() => { setOdsotnost(false); oddaja.pocisti(); }}>
                Prekliči
              </button>
            </div>
          </form>
        )}
      </div>
    </li>
  );
}
