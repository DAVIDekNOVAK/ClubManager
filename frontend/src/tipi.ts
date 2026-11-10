/** Tipi podatkov, ki jih vrača API. */
export type Vloga = 'IGRALEC' | 'TRENER' | 'VODJA_EKIPE';
export type Kategorija = 'CLANI' | 'U19' | 'U17' | 'U15' | 'U13' | 'DRUGO';

export const VLOGE: Record<Vloga, string> = {
  IGRALEC: 'Igralec',
  TRENER: 'Trener',
  VODJA_EKIPE: 'Vodja ekipe',
};
export const KATEGORIJE: Record<Kategorija, string> = {
  CLANI: 'Člani',
  U19: 'U19',
  U17: 'U17',
  U15: 'U15',
  U13: 'U13',
  DRUGO: 'Drugo',
};

export interface EkipaKratko {
  id: number;
  naziv: string;
  kategorija: Kategorija;
  jeArhivirana: boolean;
}
export interface SezonaKratko {
  id: number;
  naziv: string;
  datumZacetka: string;
  datumKonca: string;
}
export interface Clanstvo {
  id: number;
  datumPridruzitve: string;
  datumOdhoda: string | null;
  ekipa: EkipaKratko;
  sezona: SezonaKratko;
  vloge: Vloga[];
  jeAktivno: boolean;
}
export interface Profil {
  id: number;
  ime: string;
  priimek: string;
  ePosta: string;
  jeAdministrator: boolean;
  clanstva: Clanstvo[];
  /** Trenutne ekipe uporabnika z združenimi vlogami. */
  ekipe: (EkipaKratko & { vloge: Vloga[] })[];
}
