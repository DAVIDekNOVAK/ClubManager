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
export interface Ekipa extends EkipaKratko {
  steviloClanov: number;
}
export interface SezonaKratko {
  id: number;
  naziv: string;
  datumZacetka: string;
  datumKonca: string;
}
export type StatusSezone = 'NACRTOVANA' | 'AKTIVNA' | 'ZAKLJUCENA';
export interface Sezona extends SezonaKratko {
  status: StatusSezone;
}
export const STATUSI_SEZONE: Record<StatusSezone, { naziv: string; barva: 'modra' | 'zelena' | 'siva' }> = {
  NACRTOVANA: { naziv: 'Načrtovana', barva: 'modra' },
  AKTIVNA: { naziv: 'Aktivna', barva: 'zelena' },
  ZAKLJUCENA: { naziv: 'Zaključena', barva: 'siva' },
};
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

export interface UporabnikKratko {
  id: number;
  ime: string;
  priimek: string;
  ePosta?: string;
}
export interface ClanEkipe {
  id: number;
  ekipaId: number;
  sezonaId: number;
  datumPridruzitve: string;
  datumOdhoda: string | null;
  uporabnik: UporabnikKratko;
  vloge: Vloga[];
  jeOdsel: boolean;
}
export interface EkipaPodrobno extends EkipaKratko {
  mojeVloge: Vloga[];
}
export const polnoIme = (u: { ime: string; priimek: string }) => `${u.ime} ${u.priimek}`;

export type StatusPovabila = 'POSLANO' | 'SPREJETO' | 'POTEKLO';
export interface Povabilo {
  id: number;
  ePosta: string;
  vloga: Vloga;
  poslanoOb: string;
  datumPoteka: string;
  datumSprejetja: string | null;
  ekipa: { id: number; naziv: string };
  sezona: { id: number; naziv: string };
  status: StatusPovabila;
}
export const STATUSI_POVABILA: Record<StatusPovabila, { naziv: string; barva: 'modra' | 'zelena' | 'siva' }> = {
  POSLANO: { naziv: 'Poslano', barva: 'modra' },
  SPREJETO: { naziv: 'Sprejeto', barva: 'zelena' },
  POTEKLO: { naziv: 'Poteklo', barva: 'siva' },
};

export type StatusTreninga = 'NACRTOVAN' | 'ODPOVEDAN' | 'IZVEDEN';
export type PrijavljenaPrisotnost = 'NI_ODGOVORA' | 'PRIDE' | 'NE_PRIDE';
export type RazlogOdsotnosti = 'BOLEZEN' | 'POSKODBA' | 'SOLA_SLUZBA' | 'DRUGO';
export type DejanskaPrisotnost = 'PRISOTEN' | 'OPRAVICENO_ODSOTEN' | 'NEOPRAVICENO_ODSOTEN';

export const STATUSI_TRENINGA: Record<StatusTreninga, { naziv: string; barva: 'modra' | 'zelena' | 'siva' }> = {
  NACRTOVAN: { naziv: 'Načrtovan', barva: 'modra' },
  ODPOVEDAN: { naziv: 'Odpovedan', barva: 'siva' },
  IZVEDEN: { naziv: 'Izveden', barva: 'zelena' },
};
export const RAZLOGI_ODSOTNOSTI: Record<RazlogOdsotnosti, string> = {
  BOLEZEN: 'Bolezen',
  POSKODBA: 'Poškodba',
  SOLA_SLUZBA: 'Šola/služba',
  DRUGO: 'Drugo',
};
export const DEJANSKE_PRISOTNOSTI: Record<DejanskaPrisotnost, string> = {
  PRISOTEN: 'Prisoten',
  OPRAVICENO_ODSOTEN: 'Opravičeno odsoten',
  NEOPRAVICENO_ODSOTEN: 'Neopravičeno odsoten',
};

export interface PovzetekPrijav {
  pride: number;
  nePride: number;
  niOdgovora: number;
}
export interface MojaPrisotnost {
  prijavljenaPrisotnost: PrijavljenaPrisotnost;
  razlogOdsotnosti: RazlogOdsotnosti | null;
  komentar: string | null;
  dejanskaPrisotnost: DejanskaPrisotnost | null;
}
export interface Trening {
  id: number;
  ekipa: { id: number; naziv: string; jeArhivirana: boolean };
  sezonaId: number;
  zacetek: string;
  konec: string;
  lokacija: string;
  vsebina: string | null;
  status: StatusTreninga;
  jeSpremenjen: boolean;
  seJeZacel: boolean;
  jeTrener: boolean;
  /** Evidenca prijavljenega uporabnika, če je igralec na tem treningu. */
  mojaPrisotnost: MojaPrisotnost | null;
  /** Povzetek prijav – samo za trenerja ekipe in administratorja. */
  povzetek: PovzetekPrijav | null;
}

export interface NasprotniKlub {
  id: number;
  naziv: string;
  kraj: string;
  steviloTekem: number;
}

export type StatusTekme = 'NACRTOVANA' | 'ODPOVEDANA' | 'ODIGRANA' | 'ZAKLJUCENA';
export type VrstaTekmovanja = 'PRVENSTVO' | 'POKAL' | 'PRIJATELJSKA';
export const STATUSI_TEKME: Record<StatusTekme, { naziv: string; barva: 'modra' | 'zelena' | 'siva' | 'rumena' }> = {
  NACRTOVANA: { naziv: 'Načrtovana', barva: 'modra' },
  ODPOVEDANA: { naziv: 'Odpovedana', barva: 'siva' },
  ODIGRANA: { naziv: 'Odigrana', barva: 'rumena' },
  ZAKLJUCENA: { naziv: 'Zaključena', barva: 'zelena' },
};
export const VRSTE_TEKMOVANJA: Record<VrstaTekmovanja, string> = {
  PRVENSTVO: 'Prvenstvo',
  POKAL: 'Pokal',
  PRIJATELJSKA: 'Prijateljska',
};
export interface Tekma {
  id: number;
  ekipa: { id: number; naziv: string; jeArhivirana: boolean };
  sezonaId: number;
  nasprotniKlub: { id: number; naziv: string; kraj: string };
  datumInUra: string;
  jeDomaca: boolean;
  lokacija: string;
  vrstaTekmovanja: VrstaTekmovanja;
  status: StatusTekme;
  terminJeMinil: boolean;
  jeTrener: boolean;
  jeVodja: boolean;
  /** Rezultat zaključene tekme z vidika naše ekipe. */
  rezultat: { nasiGoli: number; goliNasprotnika: number } | null;
}

export type StatusRazpolozljivosti = 'NA_VOLJO' | 'ODSOTEN' | 'POSKODOVAN' | 'OMEJENO_TRENIRANJE';
// Barve statusov po US-17: zelena, rumena, rdeča, siva.
export const STATUSI_RAZPOLOZLJIVOSTI: Record<StatusRazpolozljivosti, { naziv: string; barva: 'zelena' | 'rumena' | 'rdeca' | 'siva' }> = {
  NA_VOLJO: { naziv: 'Na voljo', barva: 'zelena' },
  OMEJENO_TRENIRANJE: { naziv: 'Omejeno treniranje', barva: 'rumena' },
  POSKODOVAN: { naziv: 'Poškodovan', barva: 'rdeca' },
  ODSOTEN: { naziv: 'Odsoten', barva: 'siva' },
};
export interface StatusNaDan {
  status: StatusRazpolozljivosti;
  veljaOd: string | null;
  veljaDo: string | null;
}
export interface MojaRazpolozljivost {
  trenutni: StatusNaDan;
  zgodovina: { id: number; status: StatusRazpolozljivosti; veljaOd: string; veljaDo: string | null; ustvarjena: string }[];
}
export interface RazpolozljivostEkipe {
  datum: string;
  igralci: ({ igralecId: number; ime: string; priimek: string } & StatusNaDan)[];
  povzetek: Record<StatusRazpolozljivosti, number>;
}
