const datumFmt = new Intl.DateTimeFormat('sl-SI', { day: 'numeric', month: 'numeric', year: 'numeric', timeZone: 'UTC' });
const datumUraFmt = new Intl.DateTimeFormat('sl-SI', {
  weekday: 'short',
  day: 'numeric',
  month: 'numeric',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});
const uraFmt = new Intl.DateTimeFormat('sl-SI', { hour: '2-digit', minute: '2-digit' });

/** Datum brez ure (polja tipa DATE iz baze so v UTC). */
export const datum = (v: string | null | undefined) => (v ? datumFmt.format(new Date(v)) : '–');
/** Datum in ura v lokalnem času brskalnika. */
export const datumUra = (v: string | null | undefined) => (v ? datumUraFmt.format(new Date(v)) : '–');
export const ura = (v: string) => uraFmt.format(new Date(v));

const dvo = (n: number) => String(n).padStart(2, '0');
/** Današnji datum v obliki LLLL-MM-DD za polja <input type="date">. */
export function danes(): string {
  const d = new Date();
  return `${d.getFullYear()}-${dvo(d.getMonth() + 1)}-${dvo(d.getDate())}`;
}
/** Vrednost za <input type="date"> iz ISO-niza. */
export const zaVnosDatuma = (v: string | null | undefined) => (v ? v.slice(0, 10) : '');
/** Lokalni datum in ura iz ISO-niza, razdeljena za polji date in time. */
export function lokalniDeli(v: string): { datum: string; ura: string } {
  const d = new Date(v);
  return {
    datum: `${d.getFullYear()}-${dvo(d.getMonth() + 1)}-${dvo(d.getDate())}`,
    ura: `${dvo(d.getHours())}:${dvo(d.getMinutes())}`,
  };
}
/** Sestavi ISO-niz (UTC) iz lokalnega datuma in ure. */
export const vIso = (d: string, u: string) => new Date(`${d}T${u}:00`).toISOString();
