/** Pomožne funkcije za delo z datumi. Koledarski dnevi se računajo v časovnem pasu kluba. */
const PAS = 'Europe/Ljubljana';
const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: PAS, year: 'numeric', month: '2-digit', day: '2-digit' });

/** Koledarski dan (polnoč UTC) za dani trenutek – primerljiv s polji tipa DATE v bazi. */
export function dan(trenutek: Date = new Date()): Date {
  return new Date(`${fmt.format(trenutek)}T00:00:00Z`);
}

/** Zapis LLLL-MM-DD za polje tipa DATE. */
export const kotDatum = (d: Date) => d.toISOString().slice(0, 10);

export const dodajDni = (d: Date, dni: number) => new Date(d.getTime() + dni * 86_400_000);
export const dodajMinute = (d: Date, minute: number) => new Date(d.getTime() + minute * 60_000);
