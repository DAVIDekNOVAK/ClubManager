/** Napaka, ki jo vrne API: sporočilo za uporabnika in morebitne napake po poljih obrazca. */
export class ApiNapaka extends Error {
  constructor(
    public readonly status: number,
    sporocilo: string,
    public readonly polja: Record<string, string> = {},
  ) {
    super(sporocilo);
  }
}

type Metoda = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

async function zahteva<T>(metoda: Metoda, pot: string, telo?: unknown): Promise<T> {
  let odgovor: Response;
  try {
    odgovor = await fetch(`/api${pot}`, {
      method: metoda,
      credentials: 'same-origin',
      headers: {
        Accept: 'application/json',
        // Lastna glava je zaščita pred CSRF: tuja stran je brez dovoljenja CORS ne more poslati.
        'X-Requested-With': 'ClubManager',
        ...(telo !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: telo !== undefined ? JSON.stringify(telo) : undefined,
    });
  } catch {
    throw new ApiNapaka(0, 'Strežnik ni dosegljiv. Preverite, ali backend teče.');
  }

  if (odgovor.status === 204) return undefined as T;

  const podatki = await odgovor.json().catch(() => null);
  if (!odgovor.ok) {
    if (odgovor.status === 401) window.dispatchEvent(new Event('clubmanager:neprijavljen'));
    throw new ApiNapaka(odgovor.status, podatki?.napaka ?? 'Prišlo je do napake', podatki?.polja ?? {});
  }
  return podatki as T;
}

export const api = {
  get: <T>(pot: string) => zahteva<T>('GET', pot),
  post: <T>(pot: string, telo?: unknown) => zahteva<T>('POST', pot, telo ?? {}),
  put: <T>(pot: string, telo?: unknown) => zahteva<T>('PUT', pot, telo ?? {}),
  patch: <T>(pot: string, telo?: unknown) => zahteva<T>('PATCH', pot, telo ?? {}),
  delete: <T>(pot: string) => zahteva<T>('DELETE', pot),
};
