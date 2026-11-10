import { useState, type FormEvent } from 'react';
import { polnoIme, VRSTE_DOGODKOV, type Dogodek, type IgralecPorocila, type Nastop, type VrstaDogodka } from '../tipi';
import { Kartica, Obvestilo } from './ui';

const IKONE: Record<VrstaDogodka, string> = { GOL: '⚽', RUMENI_KARTON: '🟨', RDECI_KARTON: '🟥', MENJAVA: '⇄' };

/** Kronološki seznam dogodkov na tekmi in obrazec za nov dogodek (US-12, WF-03). */
export function DogodkiNaTekmi({
  dogodki, nastopi, igralci, lahkoUreja, obSpremembi,
}: {
  dogodki: Dogodek[];
  nastopi: Nastop[];
  igralci: Map<number, IgralecPorocila>;
  lahkoUreja: boolean;
  obSpremembi: (d: Dogodek[]) => void;
}) {
  const [vrsta, setVrsta] = useState<VrstaDogodka | ''>('');
  const [igralecId, setIgralecId] = useState('');
  const [drugiId, setDrugiId] = useState('');
  const [minuta, setMinuta] = useState('');
  const [napaka, setNapaka] = useState<string | null>(null);

  const ime = (id: number | null) => (id !== null && igralci.has(id) ? polnoIme(igralci.get(id)!) : '?');
  const vPorocilu = nastopi.map((n) => igralci.get(n.igralecId)).filter((i): i is IgralecPorocila => !!i);
  const naKlopi = nastopi.filter((n) => !n.zacetnaPostava).map((n) => igralci.get(n.igralecId)).filter((i): i is IgralecPorocila => !!i);
  // Dogodki so prikazani kronološko po minuti (AC 1).
  const urejeni = dogodki.map((d, indeks) => ({ d, indeks })).sort((a, b) => a.d.minuta - b.d.minuta || a.indeks - b.indeks);

  function dodaj(e: FormEvent) {
    e.preventDefault();
    const m = Number(minuta);
    if (!vrsta || !igralecId) return setNapaka('Izberite vrsto dogodka in igralca.');
    if (!Number.isInteger(m) || m < 1 || m > 120) return setNapaka('Minuta mora biti celo število od 1 do 120.');
    if (vrsta === 'MENJAVA' && !drugiId) return setNapaka('Pri menjavi izberite igralca, ki vstopi.');
    const id = Number(igralecId);
    // Igralec z rdečim kartonom po minuti izključitve ne more imeti novih dogodkov (AC 5).
    const izkljucitev = dogodki.find((d) => d.vrsta === 'RDECI_KARTON' && [id, Number(drugiId) || -1].includes(d.igralecId) && m > d.minuta);
    if (izkljucitev) return setNapaka(`${ime(izkljucitev.igralecId)} je bil v ${izkljucitev.minuta}. minuti izključen in po tej minuti ne more imeti novih dogodkov.`);

    obSpremembi([
      ...dogodki,
      {
        vrsta,
        igralecId: id,
        minuta: m,
        asistentId: vrsta === 'GOL' && drugiId ? Number(drugiId) : null,
        vstopilIgralecId: vrsta === 'MENJAVA' ? Number(drugiId) : null,
      },
    ]);
    setNapaka(null);
    setIgralecId('');
    setDrugiId('');
    setMinuta('');
  }

  return (
    <Kartica naslov="Dogodki na tekmi">
      {urejeni.length === 0 ? (
        <p className="tiho">Ni vnesenih dogodkov.</p>
      ) : (
        <ul className="seznam dogodki">
          {urejeni.map(({ d, indeks }) => (
            <li key={indeks} className="dogodek">
              <strong className="dogodek-minuta">{d.minuta}'</strong>
              <span aria-hidden="true">{IKONE[d.vrsta]}</span>
              <span className="dogodek-opis">
                {d.vrsta === 'MENJAVA' ? (
                  <>
                    <strong>Menjava</strong> <span className="tiho">ven {ime(d.igralecId)} · noter {ime(d.vstopilIgralecId)}</span>
                  </>
                ) : (
                  <>
                    <strong>
                      {VRSTE_DOGODKOV[d.vrsta]} – {ime(d.igralecId)}
                    </strong>
                    {d.asistentId !== null && <span className="tiho"> asist. {ime(d.asistentId)}</span>}
                  </>
                )}
              </span>
              {lahkoUreja && (
                <button className="gumb gumb-majhen gumb-nevaren" title="Odstrani dogodek" onClick={() => obSpremembi(dogodki.filter((_, i) => i !== indeks))}>
                  ✕
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {lahkoUreja && (
        <form className="nov-dogodek" onSubmit={dodaj} noValidate>
          {napaka && <Obvestilo vrsta="napaka">{napaka}</Obvestilo>}
          <div className="nov-dogodek-polja">
            <select value={vrsta} onChange={(e) => { setVrsta(e.target.value as VrstaDogodka | ''); setDrugiId(''); }} aria-label="Vrsta dogodka">
              <option value="">Vrsta</option>
              {Object.entries(VRSTE_DOGODKOV).map(([k, naziv]) => (
                <option key={k} value={k}>
                  {naziv}
                </option>
              ))}
            </select>
            <select value={igralecId} onChange={(e) => setIgralecId(e.target.value)} aria-label={vrsta === 'MENJAVA' ? 'Igralec, ki zapusti igrišče' : 'Igralec'}>
              <option value="">{vrsta === 'MENJAVA' ? 'Zapusti igrišče' : 'Igralec'}</option>
              {vPorocilu.map((i) => (
                <option key={i.igralecId} value={i.igralecId}>
                  {i.priimek} {i.ime}
                </option>
              ))}
            </select>
            {vrsta === 'GOL' && (
              <select value={drugiId} onChange={(e) => setDrugiId(e.target.value)} aria-label="Asistent">
                <option value="">Brez asistence</option>
                {/* Asistence ne more imeti strelec gola (AC 3). */}
                {vPorocilu.filter((i) => String(i.igralecId) !== igralecId).map((i) => (
                  <option key={i.igralecId} value={i.igralecId}>
                    asist. {i.priimek} {i.ime}
                  </option>
                ))}
              </select>
            )}
            {vrsta === 'MENJAVA' && (
              <select value={drugiId} onChange={(e) => setDrugiId(e.target.value)} aria-label="Igralec, ki vstopi">
                <option value="">Vstopi (s klopi)</option>
                {/* Vstopi lahko samo igralec s klopi (AC 4). */}
                {naKlopi.map((i) => (
                  <option key={i.igralecId} value={i.igralecId}>
                    {i.priimek} {i.ime}
                  </option>
                ))}
              </select>
            )}
            <input type="number" min={1} max={120} placeholder="Min." value={minuta} onChange={(e) => setMinuta(e.target.value)} aria-label="Minuta" className="minute" />
            <button className="gumb gumb-glavni" type="submit" title="Dodaj dogodek">
              +
            </button>
          </div>
          <p className="tiho majhno" style={{ margin: '0.5rem 0 0' }}>
            Minuta 1–120 · asistenca ne more biti strelec gola · pri menjavi vstopi igralec s klopi
          </p>
        </form>
      )}
    </Kartica>
  );
}
