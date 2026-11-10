import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api';
import { terminTreninga, ZnackaTreninga } from '../components/treningi';
import { GlavaStrani, Kartica, Obvestilo, Stanje, useNalozi, useOddaja, Znacka } from '../components/ui';
import { datumUra } from '../format';
import {
  DEJANSKE_PRISOTNOSTI, polnoIme, RAZLOGI_ODSOTNOSTI,
  type DejanskaPrisotnost, type PrijavljenaPrisotnost, type RazlogOdsotnosti, type Trening,
} from '../tipi';

interface IgralecPrisotnost {
  igralecId: number;
  ime: string;
  priimek: string;
  prijavljenaPrisotnost: PrijavljenaPrisotnost;
  razlogOdsotnosti: RazlogOdsotnosti | null;
  komentar: string | null;
  dejanskaPrisotnost: DejanskaPrisotnost | null;
  predlog: DejanskaPrisotnost | null;
}
interface Evidenca {
  trening: Trening;
  igralci: IgralecPrisotnost[];
  zgodovina: {
    id: number;
    datumSpremembe: string;
    staraVrednost: DejanskaPrisotnost;
    novaVrednost: DejanskaPrisotnost;
    spremenil: { ime: string; priimek: string };
    igralec: { ime: string; priimek: string };
  }[];
}

const MOZNOSTI: { vrednost: DejanskaPrisotnost; oznaka: string; razred: string }[] = [
  { vrednost: 'PRISOTEN', oznaka: 'Prisoten', razred: 'da' },
  { vrednost: 'OPRAVICENO_ODSOTEN', oznaka: 'Opravičeno', razred: 'opraviceno' },
  { vrednost: 'NEOPRAVICENO_ODSOTEN', oznaka: 'Neopravičeno', razred: 'ne' },
];

function ZnackaPrijave({ igralec }: { igralec: IgralecPrisotnost }) {
  if (igralec.prijavljenaPrisotnost === 'PRIDE') return <Znacka barva="zelena">✓ Pridem</Znacka>;
  if (igralec.prijavljenaPrisotnost === 'NE_PRIDE') {
    return (
      <Znacka barva="rdeca">
        ✗ Ne pridem{igralec.razlogOdsotnosti && ` · ${RAZLOGI_ODSOTNOSTI[igralec.razlogOdsotnosti].toLowerCase()}`}
      </Znacka>
    );
  }
  return <Znacka>? Ni odgovora</Znacka>;
}

/** Evidentiranje dejanske prisotnosti po treningu (US-08, WF-02). */
export function Prisotnost() {
  const id = Number(useParams().id);
  const evidenca = useNalozi(() => api.get<Evidenca>(`/treningi/${id}/prisotnost`), [id]);
  const [izbire, setIzbire] = useState<Record<number, DejanskaPrisotnost | null>>({});
  const [uspeh, setUspeh] = useState<string | null>(null);
  const oddaja = useOddaja();

  // Začetne vrednosti: že shranjena prisotnost, sicer predlog glede na prijavo igralca (AC 1).
  useEffect(() => {
    if (!evidenca.podatki) return;
    setIzbire(Object.fromEntries(evidenca.podatki.igralci.map((i) => [i.igralecId, i.dejanskaPrisotnost ?? i.predlog])));
  }, [evidenca.podatki]);

  if (!evidenca.podatki) return <Stanje nalaganje={evidenca.nalaganje} napaka={evidenca.napaka} />;
  const { trening: t, igralci, zgodovina } = evidenca.podatki;
  const lahkoShrani = t.jeTrener && t.seJeZacel && t.status !== 'ODPOVEDAN';
  const lahkoUreja = t.jeTrener && t.status !== 'ODPOVEDAN';
  const manjka = igralci.filter((i) => !izbire[i.igralecId]).length;

  async function shrani() {
    setUspeh(null);
    const ok = await oddaja.oddaj(() =>
      api.put(`/treningi/${id}/prisotnost`, {
        prisotnosti: igralci.map((i) => ({ igralecId: i.igralecId, dejanskaPrisotnost: izbire[i.igralecId] })),
      }),
    );
    if (ok) {
      setUspeh('Prisotnost je shranjena. Trening ima status »Izveden«.');
      await evidenca.osvezi();
    }
  }

  return (
    <>
      <GlavaStrani
        naslov="Evidentiranje prisotnosti"
        podnaslov={
          <>
            <Link to="/treningi">Treningi</Link> / <Link to={`/treningi/${t.id}`}>Trening {terminTreninga(t)}</Link> · {t.lokacija} ·{' '}
            {t.ekipa.naziv}
          </>
        }
        dejanja={<ZnackaTreninga trening={t} />}
      />
      {uspeh && <Obvestilo vrsta="uspeh">{uspeh}</Obvestilo>}
      {oddaja.napaka && <Obvestilo vrsta="napaka">{oddaja.napaka}</Obvestilo>}
      {t.status === 'ODPOVEDAN' && <Obvestilo vrsta="info">Trening je odpovedan, zato prisotnosti ni mogoče evidentirati.</Obvestilo>}

      <div className="povzetek-prijav">
        <div className="povzetek zelen">
          <span className="kazalnik-vrednost">{t.povzetek?.pride ?? 0}</span>
          <span className="kazalnik-oznaka">Potrdili udeležbo</span>
        </div>
        <div className="povzetek rdec">
          <span className="kazalnik-vrednost">{t.povzetek?.nePride ?? 0}</span>
          <span className="kazalnik-oznaka">Prijavili odsotnost</span>
        </div>
        <div className="povzetek siv">
          <span className="kazalnik-vrednost">{t.povzetek?.niOdgovora ?? 0}</span>
          <span className="kazalnik-oznaka">Brez odgovora</span>
        </div>
        {lahkoUreja && (
          <button
            className="gumb oznaci-vse"
            onClick={() => setIzbire(Object.fromEntries(igralci.map((i) => [i.igralecId, 'PRISOTEN' as const])))}
          >
            ✓ Označi vse prisotne
          </button>
        )}
      </div>

      <Kartica>
        {igralci.length === 0 ? (
          <p className="tiho">Ekipa na dan treninga nima igralcev z veljavnim članstvom.</p>
        ) : (
          <div className="tabela-ovoj">
            <table>
              <thead>
                <tr>
                  <th>Igralec</th>
                  <th>Prijava igralca</th>
                  <th>Dejanska prisotnost</th>
                  <th>Opomba</th>
                </tr>
              </thead>
              <tbody>
                {igralci.map((i) => (
                  <tr key={i.igralecId}>
                    <td>
                      <strong>{polnoIme(i)}</strong>
                    </td>
                    <td>
                      <ZnackaPrijave igralec={i} />
                    </td>
                    <td>
                      <div className="segmenti" role="radiogroup" aria-label={`Prisotnost: ${polnoIme(i)}`}>
                        {MOZNOSTI.map((m) => (
                          <button
                            key={m.vrednost}
                            type="button"
                            role="radio"
                            aria-checked={izbire[i.igralecId] === m.vrednost}
                            className={`segment${izbire[i.igralecId] === m.vrednost ? ` segment-${m.razred}` : ''}`}
                            disabled={!lahkoUreja}
                            onClick={() => setIzbire({ ...izbire, [i.igralecId]: m.vrednost })}
                          >
                            {m.oznaka}
                          </button>
                        ))}
                      </div>
                    </td>
                    <td className="tiho majhno">{i.komentar ?? '–'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Kartica>

      <div className="mreza-2">
        <Kartica naslov="Zgodovina sprememb">
          <p className="tiho majhno">Vsak popravek po shranjevanju se zabeleži.</p>
          {zgodovina.length === 0 ? (
            <p className="tiho">Ni popravkov.</p>
          ) : (
            <ul className="seznam">
              {zgodovina.map((z) => (
                <li key={z.id}>
                  <strong>{datumUra(z.datumSpremembe)}</strong> · {polnoIme(z.spremenil)} · {polnoIme(z.igralec)}:{' '}
                  {DEJANSKE_PRISOTNOSTI[z.staraVrednost]} → {DEJANSKE_PRISOTNOSTI[z.novaVrednost]}
                </li>
              ))}
            </ul>
          )}
        </Kartica>
        {t.jeTrener && (
          <div>
            <div className="dejanja" style={{ justifyContent: 'flex-end' }}>
              <Link className="gumb" to={`/treningi/${t.id}`}>
                Prekliči
              </Link>
              <button className="gumb gumb-glavni" onClick={shrani} disabled={!lahkoShrani || manjka > 0 || oddaja.posiljanje}>
                Shrani prisotnost
              </button>
            </div>
            <p className="tiho majhno desno" style={{ marginTop: '0.5rem' }}>
              {!t.seJeZacel
                ? 'Shranjevanje je možno po začetku treninga.'
                : manjka > 0
                  ? `Izberite prisotnost še za ${manjka} igralcev.`
                  : 'Po shranjevanju trening dobi status »Izveden«.'}
            </p>
          </div>
        )}
      </div>
    </>
  );
}
