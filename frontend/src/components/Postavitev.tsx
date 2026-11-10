import { Navigate, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';

/** Skupna postavitev zaščitenih strani: glava z navigacijo in vsebina. Neprijavljene preusmeri na prijavo. */
export function Postavitev() {
  const { uporabnik, nalaganje, odjava } = useAuth();
  const lokacija = useLocation();
  const navigate = useNavigate();

  if (nalaganje) return <p className="vsebina tiho">Nalaganje …</p>;
  if (!uporabnik) return <Navigate to="/prijava" replace state={{ od: lokacija.pathname }} />;

  async function obOdjavi() {
    await odjava();
    navigate('/prijava', { replace: true });
  }

  return (
    <div className="aplikacija">
      <header className="glava">
        <NavLink to="/" className="logotip">
          ⚽ ClubManager
        </NavLink>
        <nav className="navigacija">
          <NavLink to="/" end>
            Nadzorna plošča
          </NavLink>
          <NavLink to="/ekipe">Ekipe</NavLink>
          {uporabnik.jeAdministrator && <NavLink to="/sezone">Sezone</NavLink>}
        </nav>
        <div className="glava-uporabnik">
          <span>
            {uporabnik.ime} {uporabnik.priimek}
            {uporabnik.jeAdministrator && ' (administrator)'}
          </span>
          <button className="gumb gumb-majhen" onClick={obOdjavi}>
            Odjava
          </button>
        </div>
      </header>
      <main className="vsebina">
        <Outlet />
      </main>
    </div>
  );
}
