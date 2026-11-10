import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';

/** Napaka, ki se odjemalcu vrne kot JSON `{ napaka, polja? }` z ustrezno statusno kodo. */
export class HttpNapaka extends Error {
  constructor(
    public readonly status: number,
    sporocilo: string,
    public readonly polja?: Record<string, string>,
  ) {
    super(sporocilo);
  }
}

export const neveljavno = (sporocilo: string, polja?: Record<string, string>) =>
  new HttpNapaka(400, sporocilo, polja);
export const napakaPolja = (polje: string, sporocilo: string) =>
  new HttpNapaka(400, sporocilo, { [polje]: sporocilo });
export const neprijavljen = () => new HttpNapaka(401, 'Za dostop se morate prijaviti');
export const prepovedano = (sporocilo = 'Za to dejanje nimate pravic') => new HttpNapaka(403, sporocilo);
export const niNajdeno = (kaj = 'Vir') => new HttpNapaka(404, `${kaj} ne obstaja`);
export const konflikt = (sporocilo: string, polja?: Record<string, string>) =>
  new HttpNapaka(409, sporocilo, polja);

export const neznanaPot: RequestHandler = (req, _res, next) => {
  next(new HttpNapaka(404, `Pot ${req.method} ${req.path} ne obstaja`));
};

export const obravnavaNapak: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof HttpNapaka) {
    res.status(err.status).json({ napaka: err.message, polja: err.polja });
    return;
  }
  if (err instanceof ZodError) {
    const polja: Record<string, string> = {};
    for (const i of err.issues) {
      const kljuc = i.path.join('.') || '_';
      polja[kljuc] ??= i.message;
    }
    res.status(400).json({ napaka: 'Podatki niso veljavni', polja });
    return;
  }
  if (err?.type === 'entity.parse.failed') {
    res.status(400).json({ napaka: 'Telo zahteve ni veljaven JSON' });
    return;
  }
  console.error(err);
  res.status(500).json({ napaka: 'Napaka na strežniku' });
};
