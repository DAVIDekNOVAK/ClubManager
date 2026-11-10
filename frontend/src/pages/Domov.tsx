import { api } from '../api';
import { GlavaStrani, Kartica, Stanje, useNalozi, Znacka } from '../components/ui';

export function Domov() {
  const { podatki, napaka, nalaganje } = useNalozi(() => api.get<{ status: string }>('/health'));

  return (
    <>
      <GlavaStrani naslov="Nadzorna plošča" podnaslov="Spletna aplikacija za upravljanje nogometnega kluba" />
      <Kartica naslov="Stanje sistema">
        <Stanje nalaganje={nalaganje} napaka={napaka} />
        {podatki && (
          <p>
            Povezava z API-jem: <Znacka barva="zelena">{podatki.status}</Znacka>
          </p>
        )}
      </Kartica>
    </>
  );
}
