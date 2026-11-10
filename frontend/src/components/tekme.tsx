import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { danes, datumUra, lokalniDeli, vIso } from '../format';
import { STATUSI_TEKME, VRSTE_TEKMOVANJA, type NasprotniKlub, type Tekma, type VrstaTekmovanja } from '../tipi';
import { DatumAktivnosti } from './treningi';
import { Obvestilo, Polje, useOddaja, Znacka } from './ui';

/** »Člani – NK Triglav« za domačo oziroma »NK Triglav – Člani« za gostujočo tekmo. */
export const naslovTekme = (t: Pick<Tekma, 'ekipa' | 'nasprotniKlub' | 'jeDomaca'>) =>
  t.jeDomaca ? `${t.ekipa.naziv} – ${t.nasprotniKlub.naziv}` : `${t.nasprotniKlub.naziv} – ${t.ekipa.naziv}`;

/** Rezultat v vrstnem redu domači : gostje. */
export const izpisRezultata = (t: Tekma) =>
  t.rezultat ? (t.jeDomaca ? `${t.rezultat.nasiGoli} : ${t.rezultat.goliNasprotnika}` : `${t.rezultat.goliNasprotnika} : ${t.rezultat.nasiGoli}`) : null;

export const opisTekme = (t: Tekma) =>
  `${datumUra(t.datumInUra)} · ${t.jeDomaca ? 'Domača' : 'Gostujoča'} · ${VRSTE_TEKMOVANJA[t.vrstaTekmovanja]}`;

export function ZnackaTekme({ tekma }: { tekma: Tekma }) {
  return <Znacka barva={STATUSI_TEKME[tekma.status].barva}>{STATUSI_TEKME[tekma.status].naziv}</Znacka>;
}

/** Kartica tekme na nadzorni plošči (WF-01). */
export function KarticaTekme({ tekma: t }: { tekma: Tekma }) {
  const odpovedana = t.status === 'ODPOVEDANA';
  return (
    <li className={`aktivnost${odpovedana ? ' aktivnost-odpovedana' : ''}`}>
      <DatumAktivnosti datum={t.datumInUra} tekma />
      <div className="aktivnost-telo">
        <div className="vrstica">
          <div className="aktivnost-glava">
            <Znacka barva="modra">Tekma</Znacka>
            <Link to={`/tekme/${t.id}`} className={odpovedana ? 'precrtano' : undefined}>
              <strong>{naslovTekme(t)}</strong>
            </Link>
          </div>
          <ZnackaTekme tekma={t} />
        </div>
        <p className={odpovedana ? 'precrtano' : undefined}>{opisTekme(t)}</p>
        <p className="tiho majhno">{t.lokacija}</p>
      </div>
    </li>
  );
}

/** Izbira nasprotnika iz evidence z iskanjem po vsaj 2 znakih (US-10, AC 3). */
function IskalnikKluba({ izbran, obIzbiri }: { izbran: { id: number; naziv: string; kraj: string } | null; obIzbiri: (k: NasprotniKlub | null) => void }) {
  const [iskanje, setIskanje] = useState('');
  const [zadetki, setZadetki] = useState<NasprotniKlub[] | null>(null);

  useEffect(() => {
    const niz = iskanje.trim();
    if (niz.length < 2) {
      setZadetki(null);
      return;
    }
    let aktualno = true;
    api
      .get<NasprotniKlub[]>(`/nasprotni-klubi?iskanje=${encodeURIComponent(niz)}`)
      .then((k) => aktualno && setZadetki(k))
      .catch(() => aktualno && setZadetki([]));
    return () => {
      aktualno = false;
    };
  }, [iskanje]);

  if (izbran) {
    return (
      <div className="vrstica izbran-klub">
        <span>
          <strong>{izbran.naziv}</strong> <span className="tiho">· {izbran.kraj}</span>
        </span>
        <button type="button" className="gumb gumb-majhen" onClick={() => obIzbiri(null)}>
          Spremeni
        </button>
      </div>
    );
  }
  return (
    <div>
      <input
        type="search"
        value={iskanje}
        onChange={(e) => setIskanje(e.target.value)}
        placeholder="Vnesite vsaj 2 znaka naziva kluba"
        aria-label="Iskanje nasprotnega kluba"
      />
      {zadetki && (
        <ul className="zadetki">
          {zadetki.length === 0 && (
            <li className="tiho">
              Ni zadetkov. Klub najprej dodajte v <Link to="/nasprotni-klubi">evidenco nasprotnih klubov</Link>.
            </li>
          )}
          {zadetki.map((k) => (
            <li key={k.id}>
              <button type="button" className="gumb-povezava" onClick={() => { obIzbiri(k); setIskanje(''); }}>
                {k.naziv}
              </button>{' '}
              <span className="tiho">· {k.kraj}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Obrazec za novo tekmo ali urejanje načrtovane tekme (US-09). Polj za rezultat, postavo in dogodke tu ni. */
export function ObrazecTekme({
  ekipe, tekma, obUspehu, obPreklicu,
}: {
  ekipe?: { id: number; naziv: string }[];
  tekma?: Tekma;
  obUspehu: (t: Tekma) => void;
  obPreklicu: () => void;
}) {
  const zacetni = tekma ? lokalniDeli(tekma.datumInUra) : { datum: '', ura: '16:00' };
  const [ekipaId, setEkipaId] = useState(ekipe?.length === 1 ? String(ekipe[0].id) : '');
  const [klub, setKlub] = useState<{ id: number; naziv: string; kraj: string } | null>(tekma?.nasprotniKlub ?? null);
  const [datum, setDatum] = useState(zacetni.datum);
  const [ura, setUra] = useState(zacetni.ura);
  const [jeDomaca, setJeDomaca] = useState<boolean | null>(tekma?.jeDomaca ?? null);
  const [lokacija, setLokacija] = useState(tekma?.lokacija ?? '');
  const [vrsta, setVrsta] = useState<VrstaTekmovanja | ''>(tekma?.vrstaTekmovanja ?? '');
  const oddaja = useOddaja();

  async function obOddaji(e: FormEvent) {
    e.preventDefault();
    const telo = {
      ekipaId: ekipaId || undefined,
      nasprotniKlubId: klub?.id,
      datumInUra: datum && ura ? vIso(datum, ura) : undefined,
      jeDomaca: jeDomaca ?? undefined,
      lokacija,
      vrstaTekmovanja: vrsta || undefined,
    };
    let shranjena: Tekma | undefined;
    const ok = await oddaja.oddaj(async () => {
      shranjena = tekma ? await api.patch<Tekma>(`/tekme/${tekma.id}`, telo) : await api.post<Tekma>('/tekme', telo);
    });
    if (ok && shranjena) obUspehu(shranjena);
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
      <div className={`polje${oddaja.polja.nasprotniKlubId ? ' polje-napaka' : ''}`}>
        <span className="polje-oznaka">Nasprotni klub</span>
        <IskalnikKluba izbran={klub} obIzbiri={setKlub} />
        {oddaja.polja.nasprotniKlubId && <span className="polje-sporocilo">Izberite nasprotni klub iz evidence</span>}
      </div>
      <div className="obrazec-vrsta">
        <Polje oznaka="Datum" napaka={oddaja.polja.datumInUra}>
          <input type="date" value={datum} min={danes()} onChange={(e) => setDatum(e.target.value)} />
        </Polje>
        <Polje oznaka="Ura">
          <input type="time" value={ura} onChange={(e) => setUra(e.target.value)} />
        </Polje>
        <Polje oznaka="Vrsta tekmovanja" napaka={oddaja.polja.vrstaTekmovanja}>
          <select value={vrsta} onChange={(e) => setVrsta(e.target.value as VrstaTekmovanja | '')}>
            <option value="">– izberite –</option>
            {Object.entries(VRSTE_TEKMOVANJA).map(([k, ime]) => (
              <option key={k} value={k}>
                {ime}
              </option>
            ))}
          </select>
        </Polje>
      </div>
      <div className={`polje${oddaja.polja.jeDomaca ? ' polje-napaka' : ''}`}>
        <span className="polje-oznaka">Domača ali gostujoča tekma</span>
        <div className="izbire" role="radiogroup">
          <label className="izbira">
            <input type="radio" name="jeDomaca" checked={jeDomaca === true} onChange={() => setJeDomaca(true)} /> Domača
          </label>
          <label className="izbira">
            <input type="radio" name="jeDomaca" checked={jeDomaca === false} onChange={() => setJeDomaca(false)} /> Gostujoča
          </label>
        </div>
        {oddaja.polja.jeDomaca && <span className="polje-sporocilo">{oddaja.polja.jeDomaca}</span>}
      </div>
      <Polje oznaka="Lokacija" napaka={oddaja.polja.lokacija}>
        <input type="text" value={lokacija} onChange={(e) => setLokacija(e.target.value)} maxLength={100} />
      </Polje>
      <div className="dejanja">
        <button className="gumb gumb-glavni" type="submit" disabled={oddaja.posiljanje}>
          {tekma ? 'Shrani spremembe' : 'Dodaj tekmo'}
        </button>
        <button className="gumb" type="button" onClick={obPreklicu}>
          Prekliči
        </button>
      </div>
    </form>
  );
}
