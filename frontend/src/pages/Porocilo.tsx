import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api';
import { opisTekme, ZnackaTekme } from '../components/tekme';
import { GlavaStrani, izNapake, Kartica, Modal, Obvestilo, Stanje, Znacka } from '../components/ui';
import { polnoIme, STATUSI_RAZPOLOZLJIVOSTI, type IgralecPorocila, type Nastop, type PorociloTekme } from '../tipi';

/** Poročilo o tekmi (US-11, WF-03): rezultat, začetna postava, klop in odigrane minute. */
export function Porocilo() {
  const id = Number(useParams().id);
  const [podatki, setPodatki] = useState<PorociloTekme | null>(null);
  const [napakaNalaganja, setNapakaNalaganja] = useState<string | null>(null);
  const [nasiGoli, setNasiGoli] = useState('');
  const [goliNasprotnika, setGoliNasprotnika] = useState('');
  const [nastopi, setNastopi] = useState<Nastop[]>([]);
  const [potrjenaOpozorila, setPotrjenaOpozorila] = useState<number[]>([]);
  const [zaPotrditev, setZaPotrditev] = useState<{ igralec: IgralecPorocila; zacetnaPostava: boolean } | null>(null);
  const [izbranIgralec, setIzbranIgralec] = useState('');
  const [sporocilo, setSporocilo] = useState<{ vrsta: 'uspeh' | 'napaka'; besedilo: string } | null>(null);
  const [posiljanje, setPosiljanje] = useState(false);

  async function nalozi() {
    try {
      let p = await api.get<PorociloTekme>(`/tekme/${id}/porocilo`).catch(async (e) => {
        // Trener poročilo odpre ob prvem obisku po terminu tekme – tekma dobi status »Odigrana« (AC 1).
        await api.post(`/tekme/${id}/porocilo/odpri`).catch(() => {
          throw e;
        });
        return api.get<PorociloTekme>(`/tekme/${id}/porocilo`);
      });
      if (p.tekma.jeTrener && p.tekma.status === 'NACRTOVANA') {
        await api.post(`/tekme/${id}/porocilo/odpri`);
        p = await api.get<PorociloTekme>(`/tekme/${id}/porocilo`);
      }
      setPodatki(p);
      setNasiGoli(p.nasiGoli === null ? '' : String(p.nasiGoli));
      setGoliNasprotnika(p.goliNasprotnika === null ? '' : String(p.goliNasprotnika));
      setNastopi(p.nastopi);
      // Za že shranjene igralce z opozorilom je trener opozorilo potrdil ob izbiri.
      const zOpozorilom = new Set(p.igralci.filter((i) => i.zahtevaPotrditev).map((i) => i.igralecId));
      setPotrjenaOpozorila(p.nastopi.filter((n) => zOpozorilom.has(n.igralecId)).map((n) => n.igralecId));
      setNapakaNalaganja(null);
    } catch (e) {
      setNapakaNalaganja(izNapake(e).sporocilo);
    }
  }

  useEffect(() => {
    void nalozi();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (!podatki) return <Stanje nalaganje={!napakaNalaganja} napaka={napakaNalaganja} />;
  const t = podatki.tekma;
  const lahkoUreja = t.jeTrener && t.status === 'ODIGRANA';
  const igralecPoId = new Map(podatki.igralci.map((i) => [i.igralecId, i]));
  const zacetna = nastopi.filter((n) => n.zacetnaPostava);
  const klop = nastopi.filter((n) => !n.zacetnaPostava);
  const prosti = podatki.igralci.filter((i) => !nastopi.some((n) => n.igralecId === i.igralecId));

  const stevilo = (v: string) => (v.trim() === '' || Number.isNaN(Number(v)) ? null : Number(v));
  const telo = () => ({ nasiGoli: stevilo(nasiGoli), goliNasprotnika: stevilo(goliNasprotnika), nastopi, potrjenaOpozorila });

  // Sprotno preverjanje pogojev za potrditev (polje »Preverjanje« na WF-03).
  const preverjanje = [
    { ok: stevilo(nasiGoli) !== null && stevilo(goliNasprotnika) !== null, besedilo: 'Rezultat je vnesen' },
    { ok: zacetna.length === 11, besedilo: `Začetna postava ${zacetna.length}/11` },
  ];
  const vseOk = preverjanje.every((p) => p.ok);

  function dodaj(igralec: IgralecPorocila, zacetnaPostava: boolean, potrjeno = false) {
    // Poškodovanega ali odsotnega igralca je mogoče izbrati šele po potrditvi opozorila (AC 2).
    if (igralec.zahtevaPotrditev && !potrjeno) {
      setZaPotrditev({ igralec, zacetnaPostava });
      return;
    }
    if (igralec.zahtevaPotrditev) setPotrjenaOpozorila([...potrjenaOpozorila, igralec.igralecId]);
    setNastopi([...nastopi, { igralecId: igralec.igralecId, zacetnaPostava, odigraneMinute: zacetnaPostava ? 90 : 0 }]);
    setIzbranIgralec('');
    setZaPotrditev(null);
  }
  const spremeni = (igralecId: number, sprememba: Partial<Nastop>) =>
    setNastopi(nastopi.map((n) => (n.igralecId === igralecId ? { ...n, ...sprememba } : n)));
  const odstrani = (igralecId: number) => setNastopi(nastopi.filter((n) => n.igralecId !== igralecId));

  async function shrani(potrdi: boolean) {
    setPosiljanje(true);
    setSporocilo(null);
    try {
      if (potrdi) await api.post(`/tekme/${id}/porocilo/potrdi`, telo());
      else await api.put(`/tekme/${id}/porocilo`, telo());
      await nalozi();
      setSporocilo({
        vrsta: 'uspeh',
        besedilo: potrdi ? 'Poročilo je potrjeno. Tekma ima status »Zaključena« in je vključena v statistiko.' : 'Osnutek poročila je shranjen.',
      });
    } catch (e) {
      setSporocilo({ vrsta: 'napaka', besedilo: izNapake(e).sporocilo });
    } finally {
      setPosiljanje(false);
    }
  }

  const vrstica = (n: Nastop) => {
    const igralec = igralecPoId.get(n.igralecId);
    const status = igralec ? STATUSI_RAZPOLOZLJIVOSTI[igralec.status] : null;
    return (
      <li key={n.igralecId} className="postava-vrstica">
        <span className="postava-ime">{igralec ? polnoIme(igralec) : `Igralec ${n.igralecId}`}</span>
        {status && <Znacka barva={status.barva}>{status.naziv}</Znacka>}
        <input
          type="number"
          min={0}
          max={120}
          step={1}
          className="minute"
          aria-label={`Odigrane minute: ${igralec ? polnoIme(igralec) : ''}`}
          value={n.odigraneMinute}
          disabled={!lahkoUreja}
          onChange={(e) => spremeni(n.igralecId, { odigraneMinute: e.target.value === '' ? 0 : Math.trunc(Number(e.target.value)) })}
        />
        {lahkoUreja && (
          <span className="dejanja">
            <button
              className="gumb gumb-majhen"
              title={n.zacetnaPostava ? 'Premakni na klop' : 'Premakni v začetno postavo'}
              onClick={() => spremeni(n.igralecId, { zacetnaPostava: !n.zacetnaPostava })}
            >
              {n.zacetnaPostava ? '↓ Klop' : '↑ Postava'}
            </button>
            <button className="gumb gumb-majhen gumb-nevaren" title="Odstrani iz poročila" onClick={() => odstrani(n.igralecId)}>
              ✕
            </button>
          </span>
        )}
      </li>
    );
  };

  const nasi = { naziv: t.ekipa.naziv, vrednost: nasiGoli, nastavi: setNasiGoli, oznaka: 'Naši goli' };
  const nasprotnik = { naziv: t.nasprotniKlub.naziv, vrednost: goliNasprotnika, nastavi: setGoliNasprotnika, oznaka: 'Goli nasprotnika' };
  const [domaci, gosti] = t.jeDomaca ? [nasi, nasprotnik] : [nasprotnik, nasi];

  return (
    <>
      <GlavaStrani
        naslov="Poročilo o tekmi"
        podnaslov={
          <>
            <Link to="/tekme">Tekme</Link> / <Link to={`/tekme/${t.id}`}>{domaci.naziv} – {gosti.naziv}</Link> · {opisTekme(t)}
          </>
        }
        dejanja={<ZnackaTekme tekma={t} />}
      />
      {sporocilo && <Obvestilo vrsta={sporocilo.vrsta}>{sporocilo.besedilo}</Obvestilo>}

      <div className="semafor">
        <div className="semafor-ekipa desno">
          <strong>{domaci.naziv}</strong>
          <span>domači</span>
        </div>
        <input type="number" min={0} max={99} aria-label={domaci.oznaka} value={domaci.vrednost} disabled={!lahkoUreja} onChange={(e) => domaci.nastavi(e.target.value)} />
        <span className="semafor-locilo">:</span>
        <input type="number" min={0} max={99} aria-label={gosti.oznaka} value={gosti.vrednost} disabled={!lahkoUreja} onChange={(e) => gosti.nastavi(e.target.value)} />
        <div className="semafor-ekipa">
          <strong>{gosti.naziv}</strong>
          <span>gosti</span>
        </div>
      </div>

      <div className="mreza-pol">
        <Kartica
          naslov={
            <>
              Začetna postava <Znacka barva={zacetna.length === 11 ? 'zelena' : 'rumena'}>{zacetna.length} / 11</Znacka>
            </>
          }
          dejanja={<span className="tiho majhno">MINUTE</span>}
        >
          {zacetna.length === 0 ? <p className="tiho">V začetni postavi še ni igralcev.</p> : <ul className="seznam postava">{zacetna.map(vrstica)}</ul>}
          <h3 style={{ marginTop: '1rem' }}>Klop</h3>
          {klop.length === 0 ? <p className="tiho">Na klopi ni igralcev.</p> : <ul className="seznam postava">{klop.map(vrstica)}</ul>}

          {lahkoUreja && (
            <div className="dodaj-igralca">
              <select value={izbranIgralec} onChange={(e) => setIzbranIgralec(e.target.value)} aria-label="Igralec">
                <option value="">+ Dodaj igralca …</option>
                {prosti.map((i) => (
                  <option key={i.igralecId} value={i.igralecId}>
                    {i.priimek} {i.ime}
                    {i.status !== 'NA_VOLJO' ? ` (${STATUSI_RAZPOLOZLJIVOSTI[i.status].naziv.toLowerCase()})` : ''}
                  </option>
                ))}
              </select>
              <button className="gumb" disabled={!izbranIgralec || zacetna.length >= 11} onClick={() => dodaj(igralecPoId.get(Number(izbranIgralec))!, true)}>
                V postavo
              </button>
              <button className="gumb" disabled={!izbranIgralec} onClick={() => dodaj(igralecPoId.get(Number(izbranIgralec))!, false)}>
                Na klop
              </button>
            </div>
          )}
          <p className="tiho majhno" style={{ margin: '0.75rem 0 0' }}>
            Izbrati je mogoče samo igralce z veljavnim članstvom na dan tekme. Poškodovane in odsotne igralce je mogoče izbrati po
            potrditvi opozorila.
          </p>
        </Kartica>

        <div>
          {(lahkoUreja || t.status === 'ODIGRANA') && (
            <Kartica naslov="Preverjanje">
              <ul className="seznam">
                {preverjanje.map((p) => (
                  <li key={p.besedilo} className={p.ok ? 'preverjanje-ok' : 'preverjanje-napaka'}>
                    {p.ok ? '✓' : '✗'} {p.besedilo}
                  </li>
                ))}
              </ul>
            </Kartica>
          )}
          {lahkoUreja && (
            <>
              <div className="dejanja" style={{ justifyContent: 'flex-end' }}>
                <button className="gumb" onClick={() => shrani(false)} disabled={posiljanje}>
                  Shrani osnutek
                </button>
                <button className="gumb gumb-glavni" onClick={() => shrani(true)} disabled={posiljanje || !vseOk}>
                  Potrdi poročilo
                </button>
              </div>
              <p className="tiho majhno desno" style={{ marginTop: '0.5rem' }}>
                Po potrditvi tekma dobi status »Zaključena« in se upošteva v statistiki.
              </p>
            </>
          )}
        </div>
      </div>

      {zaPotrditev && (
        <Modal naslov="Opozorilo o razpoložljivosti" obZaprtju={() => setZaPotrditev(null)}>
          <p>
            <strong>{polnoIme(zaPotrditev.igralec)}</strong> ima na dan tekme status »
            {STATUSI_RAZPOLOZLJIVOSTI[zaPotrditev.igralec.status].naziv}«. Ali ga res želite izbrati?
          </p>
          <div className="dejanja">
            <button className="gumb gumb-glavni" onClick={() => dodaj(zaPotrditev.igralec, zaPotrditev.zacetnaPostava, true)}>
              Potrdi in izberi
            </button>
            <button className="gumb" onClick={() => setZaPotrditev(null)}>
              Prekliči
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
