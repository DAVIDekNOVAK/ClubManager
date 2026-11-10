// Baza razvršča po kodah znakov, zato bi bile črke č, š, ž na koncu abecede.
// Sezname imen zato razvrstimo v aplikaciji po slovenskih pravilih.
const sl = new Intl.Collator('sl', { sensitivity: 'base', numeric: true });

export const poNazivu = <T extends { naziv: string }>(a: T, b: T) => sl.compare(a.naziv, b.naziv);
export const poPriimku = <T extends { ime: string; priimek: string }>(a: T, b: T) =>
  sl.compare(a.priimek, b.priimek) || sl.compare(a.ime, b.ime);
