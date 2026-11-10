import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';
import { Kartoni } from '../components/statistika';
import { GlavaStrani, Kartica, Obvestilo, Stanje, useNalozi } from '../components/ui';
import { odstotek, polnoIme, VRSTE_TEKMOVANJA, type StatistikaEkipe, type VrsticaIgralca, type VrstaTekmovanja } from '../tipi';

type Stolpec = 'priimek' | 'nastopi' | 'zacetnePostave' | 'minute' | 'goli' | 'asistence' | 'kartoni' | 'prisotnost';
const STOLPCI: { kljuc: Stolpec; naziv: string; stevilo?: boolean }[] = [
  { kljuc: 'priimek', naziv: 'Igralec' },
  { kljuc: 'nastopi', naziv: 'Nastopi', stevilo: true },
  { kljuc: 'zacetnePostave', naziv: 'Zač. post.', stevilo: true },
  { kljuc: 'minute', naziv: 'Minute', stevilo: true },
  { kljuc: 'goli', naziv: 'Goli', stevilo: true },
  { kljuc: 'asistence', naziv: 'Asist.', stevilo: true },
  { kljuc: 'kartoni', naziv: 'Kartoni' },
  { kljuc: 'prisotnost', naziv: 'Prisotnost' },
];
const sl = new Intl.Collator('sl');

function vrednost(v: VrsticaIgralca, stolpec: Stolpec): number | string {
  if (stolpec === 'priimek') return `${v.priimek} ${v.ime}`;
  // Rdeči karton šteje več kot rumeni.
  if (stolpec === 'kartoni') return v.rdeciKartoni * 100 + v.rumeniKartoni;
  if (stolpec === 'prisotnost') return v.prisotnost ?? -1;
  return v[stolpec];
}

/** Statistika ekipe in njenih igralcev (US-15, WF-04). */
export function StatistikaEkipeStran() {
  const ekipaId = Number(useParams().id);
  const navigate = useNavigate();
  const [sezonaId, setSezonaId] = useState<number | null>(null);
  const [vrsta, setVrsta] = useState<VrstaTekmovanja | ''>('');
  const [razvrsti, setRazvrsti] = useState<{ stolpec: Stolpec; padajoce: boolean }>({ stolpec: 'goli', padajoce: true });
  const stat = useNalozi(() => {
    const parametri = new URLSearchParams();
    if (sezonaId) parametri.set('sezonaId', String(sezonaId));
    if (vrsta) parametri.set('vrstaTekmovanja', vrsta);
    return api.get<StatistikaEkipe>(`/statistika/ekipa/${ekipaId}?${parametri}`);
  }, [ekipaId, sezonaId, vrsta]);

  if (!stat.podatki) return <Stanje nalaganje={stat.nalaganje} napaka={stat.napaka} />;
  const { ekipa, povzetek: p, zadnjeTekme, najboljsiStrelec, sezone } = stat.podatki;

  // Klik na glavo stolpca razvrsti tabelo po tem stolpcu; ponoven klik obrne vrstni red (AC 2).
  const igralci = [...stat.podatki.igralci].sort((a, b) => {
    const [x, y] = [vrednost(a, razvrsti.stolpec), vrednost(b, razvrsti.stolpec)];
    const razlika = typeof x === 'string' ? sl.compare(x, y as string) : x - (y as number);
    return (razvrsti.padajoce ? -razlika : razlika) || sl.compare(a.priimek, b.priimek);
  });
  const obKlikuGlave = (stolpec: Stolpec) =>
    setRazvrsti((r) => (r.stolpec === stolpec ? { stolpec, padajoce: !r.padajoce } : { stolpec, padajoce: stolpec !== 'priimek' }));
  const barvaPrisotnosti = (v: number | null) => (v === null ? 'siva' : v >= 85 ? 'zelena' : v >= 75 ? 'rumena' : 'rdeca');

  return (
    <>
      <GlavaStrani
        naslov={`Statistika ekipe – ${ekipa.naziv}`}
        podnaslov={
          <>
            <Link to={`/ekipe/${ekipa.id}`}>{ekipa.naziv}</Link> · samo zaključene tekme in izvedeni treningi
          </>
        }
        dejanja={
          <>
            <select value={stat.podatki.sezonaId} onChange={(e) => setSezonaId(Number(e.target.value))} aria-label="Sezona" style={{ width: 'auto' }}>
              {sezone.map((s) => (
                <option key={s.id} value={s.id}>
                  Sezona {s.naziv}
                  {s.status === 'AKTIVNA' ? ' (trenutna)' : ''}
                </option>
              ))}
            </select>
            <select value={vrsta} onChange={(e) => setVrsta(e.target.value as VrstaTekmovanja | '')} aria-label="Tekmovanje" style={{ width: 'auto' }}>
              <option value="">Vsa tekmovanja</option>
              {Object.entries(VRSTE_TEKMOVANJA).map(([k, naziv]) => (
                <option key={k} value={k}>
                  {naziv}
                </option>
              ))}
            </select>
          </>
        }
      />

      <div className="povzetek-ekipe">
        {[
          { v: p.tekme, o: 'Tekme', r: '' },
          { v: p.zmage, o: 'Zmage', r: 'zelena' },
          { v: p.remiji, o: 'Remiji', r: 'siva' },
          { v: p.porazi, o: 'Porazi', r: 'rdeca' },
          { v: `${p.daniGoli}:${p.prejetiGoli}`, o: 'Goli (dani:prejeti)', r: '' },
          { v: odstotek(p.povprecnaPrisotnost), o: 'Povp. prisotnost', r: 'modra' },
        ].map((k) => (
          <div className="kartica povzetek-kazalnik" key={k.o}>
            <div className={`kazalnik-vrednost besedilo-${k.r}`}>{k.v}</div>
            <div className="kazalnik-oznaka">{k.o}</div>
          </div>
        ))}
      </div>

      <div className="vrstica" style={{ marginBottom: '1rem' }}>
        <div className="dejanja">
          <strong>Zadnjih 5 tekem</strong>
          {zadnjeTekme.length === 0 && <span className="tiho">ni zaključenih tekem</span>}
          {/* Od najstarejše proti najnovejši, kot na wireframu. */}
          {[...zadnjeTekme].reverse().map((t) => (
            <Link
              key={t.id}
              to={`/tekme/${t.id}`}
              className={`izid izid-${t.izid}`}
              title={`${t.nasprotnik} ${t.nasiGoli}:${t.goliNasprotnika}`}
              aria-label={`${t.izid === 'Z' ? 'Zmaga' : t.izid === 'R' ? 'Remi' : 'Poraz'} proti ${t.nasprotnik}, ${t.nasiGoli}:${t.goliNasprotnika}`}
            >
              {t.izid}
            </Link>
          ))}
        </div>
        {najboljsiStrelec && (
          <span className="tiho">
            Najboljši strelec: {polnoIme(najboljsiStrelec)} ({najboljsiStrelec.goli})
          </span>
        )}
      </div>

      <Kartica>
        {igralci.length === 0 ? (
          <p className="tiho">Ekipa v izbrani sezoni nima igralcev.</p>
        ) : (
          <div className="tabela-ovoj">
            <table>
              <thead>
                <tr>
                  {STOLPCI.map((s) => (
                    <th
                      key={s.kljuc}
                      className={`razvrsti${s.stevilo ? ' stevilo' : ''}${razvrsti.stolpec === s.kljuc ? ' razvrsti-aktiven' : ''}`}
                      onClick={() => obKlikuGlave(s.kljuc)}
                      aria-sort={razvrsti.stolpec === s.kljuc ? (razvrsti.padajoce ? 'descending' : 'ascending') : 'none'}
                    >
                      {s.naziv}
                      {razvrsti.stolpec === s.kljuc ? (razvrsti.padajoce ? ' ▼' : ' ▲') : ''}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {igralci.map((i) => (
                  // Klik na igralca odpre njegovo podrobno statistiko po sezonah (AC 3).
                  <tr key={i.igralecId} className="klik" onClick={() => navigate(`/statistika/igralec/${i.igralecId}`)}>
                    <td>
                      <Link to={`/statistika/igralec/${i.igralecId}`} onClick={(e) => e.stopPropagation()}>
                        <strong>{polnoIme(i)}</strong>
                      </Link>
                    </td>
                    <td className="stevilo">{i.nastopi}</td>
                    <td className="stevilo">{i.zacetnePostave}</td>
                    <td className="stevilo">{i.minute}</td>
                    <td className="stevilo">{i.goli}</td>
                    <td className="stevilo">{i.asistence}</td>
                    <td>
                      <Kartoni s={i} />
                    </td>
                    <td>
                      <div className="prisotnost-celica">
                        <div className="napredek">
                          <span className={`napredek-${barvaPrisotnosti(i.prisotnost)}`} style={{ width: `${i.prisotnost ?? 0}%` }} />
                        </div>
                        <strong>{odstotek(i.prisotnost)}</strong>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Kartica>

      <Obvestilo vrsta="info">
        <strong>Kako brati tabelo</strong>
        <br />
        Klik na glavo stolpca razvrsti tabelo. Klik na igralca odpre njegovo podrobno statistiko po sezonah.
      </Obvestilo>
    </>
  );
}
