import { useEffect, useState } from 'react';
import { api } from '../api';
import type { Sezona } from '../tipi';

/** Naloži sezone in privzeto izbere aktivno (če je ni, najnovejšo). */
export function useSezone() {
  const [sezone, setSezone] = useState<Sezona[]>([]);
  const [sezonaId, setSezonaId] = useState<number | null>(null);

  useEffect(() => {
    api
      .get<Sezona[]>('/sezone')
      .then((seznam) => {
        setSezone(seznam);
        const privzeta = seznam.find((s) => s.status === 'AKTIVNA') ?? seznam[0];
        setSezonaId((trenutna) => trenutna ?? privzeta?.id ?? null);
      })
      .catch(() => setSezone([]));
  }, []);

  return { sezone, sezonaId, setSezonaId, sezona: sezone.find((s) => s.id === sezonaId) ?? null };
}

export function IzbiraSezone({ sezone, vrednost, obSpremembi }: { sezone: Sezona[]; vrednost: number | null; obSpremembi: (id: number) => void }) {
  return (
    <select value={vrednost ?? ''} onChange={(e) => obSpremembi(Number(e.target.value))} aria-label="Sezona" style={{ width: 'auto' }}>
      {sezone.map((s) => (
        <option key={s.id} value={s.id}>
          Sezona {s.naziv}
          {s.status === 'AKTIVNA' ? ' (trenutna)' : ''}
        </option>
      ))}
    </select>
  );
}
