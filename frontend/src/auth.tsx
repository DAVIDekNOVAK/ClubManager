import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, ApiNapaka } from './api';
import type { Profil, Vloga } from './tipi';

interface AuthKontekst {
  /** Prijavljeni uporabnik; `null`, če ni prijavljen. */
  uporabnik: Profil | null;
  /** Dokler ne vemo, ali seja obstaja, zaščitenih strani ne prikažemo. */
  nalaganje: boolean;
  prijava: (ePosta: string, geslo: string) => Promise<void>;
  odjava: () => Promise<void>;
  osvezi: () => Promise<void>;
  nastavi: (profil: Profil) => void;
  /** Ali ima uporabnik v kateri koli (ali izbrani) ekipi dano vlogo. */
  imaVlogo: (vloga: Vloga, ekipaId?: number) => boolean;
}

const Kontekst = createContext<AuthKontekst | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [uporabnik, setUporabnik] = useState<Profil | null>(null);
  const [nalaganje, setNalaganje] = useState(true);

  const osvezi = useCallback(async () => {
    try {
      setUporabnik(await api.get<Profil>('/auth/jaz'));
    } catch (e) {
      if (e instanceof ApiNapaka && e.status === 401) setUporabnik(null);
    } finally {
      setNalaganje(false);
    }
  }, []);

  useEffect(() => {
    void osvezi();
    // Če katera koli zahteva vrne 401 (seja je potekla ali bila uničena), uporabnika odjavimo.
    const obNeprijavljen = () => setUporabnik(null);
    window.addEventListener('clubmanager:neprijavljen', obNeprijavljen);
    return () => window.removeEventListener('clubmanager:neprijavljen', obNeprijavljen);
  }, [osvezi]);

  const vrednost = useMemo<AuthKontekst>(
    () => ({
      uporabnik,
      nalaganje,
      osvezi,
      nastavi: setUporabnik,
      prijava: async (ePosta, geslo) => {
        setUporabnik(await api.post<Profil>('/auth/prijava', { ePosta, geslo }));
      },
      odjava: async () => {
        await api.post('/auth/odjava');
        setUporabnik(null);
      },
      imaVlogo: (vloga, ekipaId) =>
        !!uporabnik?.ekipe.some((e) => (ekipaId === undefined || e.id === ekipaId) && e.vloge.includes(vloga)),
    }),
    [uporabnik, nalaganje, osvezi],
  );

  return <Kontekst.Provider value={vrednost}>{children}</Kontekst.Provider>;
}

export function useAuth(): AuthKontekst {
  const k = useContext(Kontekst);
  if (!k) throw new Error('useAuth je mogoče uporabiti samo znotraj AuthProvider');
  return k;
}

/** Prijavljeni uporabnik na zaščitenih straneh (tam vedno obstaja). */
export function useUporabnik(): Profil {
  const { uporabnik } = useAuth();
  if (!uporabnik) throw new Error('Uporabnik ni prijavljen');
  return uporabnik;
}
