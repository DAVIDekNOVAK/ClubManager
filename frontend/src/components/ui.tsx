import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { ApiNapaka } from '../api';

/** Naloži podatke ob prikazu komponente; vrne stanje nalaganja, napako in funkcijo za osvežitev. */
export function useNalozi<T>(nalozi: () => Promise<T>, odvisnosti: unknown[] = []) {
  const [podatki, setPodatki] = useState<T | null>(null);
  const [napaka, setNapaka] = useState<string | null>(null);
  const [nalaganje, setNalaganje] = useState(true);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const osvezi = useCallback(async () => {
    try {
      setPodatki(await nalozi());
      setNapaka(null);
    } catch (e) {
      setNapaka(e instanceof Error ? e.message : 'Prišlo je do napake');
    } finally {
      setNalaganje(false);
    }
  }, odvisnosti);

  useEffect(() => {
    setNalaganje(true);
    void osvezi();
  }, [osvezi]);

  return { podatki, napaka, nalaganje, osvezi };
}

/** Pretvori napako API-ja v sporočilo in napake po poljih obrazca. */
export function izNapake(e: unknown): { sporocilo: string; polja: Record<string, string> } {
  if (e instanceof ApiNapaka) return { sporocilo: e.message, polja: e.polja };
  return { sporocilo: e instanceof Error ? e.message : 'Prišlo je do napake', polja: {} };
}

export function Stanje({ nalaganje, napaka }: { nalaganje: boolean; napaka: string | null }) {
  if (napaka) return <Obvestilo vrsta="napaka">{napaka}</Obvestilo>;
  if (nalaganje) return <p className="tiho">Nalaganje …</p>;
  return null;
}

export function Obvestilo({ vrsta = 'info', children }: { vrsta?: 'info' | 'napaka' | 'uspeh' | 'opozorilo'; children: ReactNode }) {
  return (
    <div className={`obvestilo obvestilo-${vrsta}`} role={vrsta === 'napaka' ? 'alert' : 'status'}>
      {children}
    </div>
  );
}

/** Polje obrazca z oznako in napako ob polju. */
export function Polje({ oznaka, napaka, namig, children }: { oznaka: string; napaka?: string; namig?: string; children: ReactNode }) {
  return (
    <label className={`polje${napaka ? ' polje-napaka' : ''}`}>
      <span className="polje-oznaka">{oznaka}</span>
      {children}
      {namig && !napaka && <span className="polje-namig">{namig}</span>}
      {napaka && <span className="polje-sporocilo">{napaka}</span>}
    </label>
  );
}

export function Znacka({ barva = 'siva', children }: { barva?: 'siva' | 'zelena' | 'rumena' | 'rdeca' | 'modra'; children: ReactNode }) {
  return <span className={`znacka znacka-${barva}`}>{children}</span>;
}

export function Kartica({ naslov, dejanja, children }: { naslov?: ReactNode; dejanja?: ReactNode; children: ReactNode }) {
  return (
    <section className="kartica">
      {(naslov || dejanja) && (
        <header className="kartica-glava">
          {naslov && <h2>{naslov}</h2>}
          {dejanja && <div className="dejanja">{dejanja}</div>}
        </header>
      )}
      {children}
    </section>
  );
}

export function GlavaStrani({ naslov, podnaslov, dejanja }: { naslov: ReactNode; podnaslov?: ReactNode; dejanja?: ReactNode }) {
  return (
    <div className="glava-strani">
      <div>
        <h1>{naslov}</h1>
        {podnaslov && <p className="tiho">{podnaslov}</p>}
      </div>
      {dejanja && <div className="dejanja">{dejanja}</div>}
    </div>
  );
}

/** Stanje oddaje obrazca: pošiljanje, splošna napaka in napake po poljih. */
export function useOddaja() {
  const [napaka, setNapaka] = useState<string | null>(null);
  const [polja, setPolja] = useState<Record<string, string>>({});
  const [posiljanje, setPosiljanje] = useState(false);

  /** Izvede dejanje; vrne `true`, če je uspelo. Napako API-ja razdeli na splošno in napake po poljih. */
  async function oddaj(dejanje: () => Promise<unknown>): Promise<boolean> {
    setPosiljanje(true);
    setNapaka(null);
    setPolja({});
    try {
      await dejanje();
      return true;
    } catch (e) {
      const n = izNapake(e);
      setPolja(n.polja);
      // Če je napaka vezana na polja, se prikaže ob njih; sicer nad obrazcem.
      setNapaka(Object.keys(n.polja).length > 0 ? null : n.sporocilo);
      return false;
    } finally {
      setPosiljanje(false);
    }
  }

  const pocisti = () => {
    setNapaka(null);
    setPolja({});
  };

  return { napaka, polja, posiljanje, oddaj, pocisti };
}

export function Modal({ naslov, children, obZaprtju }: { naslov: string; children: ReactNode; obZaprtju: () => void }) {
  useEffect(() => {
    const obTipki = (e: KeyboardEvent) => e.key === 'Escape' && obZaprtju();
    window.addEventListener('keydown', obTipki);
    return () => window.removeEventListener('keydown', obTipki);
  }, [obZaprtju]);

  return (
    <div className="modal-ozadje" onMouseDown={(e) => e.target === e.currentTarget && obZaprtju()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={naslov}>
        <h2>{naslov}</h2>
        {children}
      </div>
    </div>
  );
}
