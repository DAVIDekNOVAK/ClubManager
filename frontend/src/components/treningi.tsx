import { useState, type FormEvent } from 'react';
import { api } from '../api';
import { danes, datumUra, lokalniDeli, ura, vIso } from '../format';
import { STATUSI_TRENINGA, type Trening } from '../tipi';
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
