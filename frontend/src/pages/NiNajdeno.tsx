import { Link } from 'react-router-dom';
import { GlavaStrani } from '../components/ui';

export function NiNajdeno() {
  return (
    <>
      <GlavaStrani naslov="Stran ne obstaja" />
      <p>
        <Link to="/">Nazaj na nadzorno ploščo</Link>
      </p>
    </>
  );
}
