import { Navigate, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';

/**
 * Skupna postavitev zaščitenih strani po wireframih: stranski meni, zgornja vrstica
 * z uporabnikom in vsebina. Neprijavljene preusmeri na prijavo.
 */
export function Postavitev() {
  const { uporabnik, nalaganje, odjava, imaVlogo } = useAuth();
  const lokacija = useLocation();
  const navigate = useNavigate();

  if (nalaganje) return <p className="vsebina tiho">Nalaganje …</p>;
  if (!uporabnik) return <Navigate to="/prijava" replace state={{ od: lokacija.pathname }} />;

  async function obOdjavi() {
    await odjava();
    navigate('/prijava', { replace: true });
  }

  const zacetnici = `${uporabnik.ime[0] ?? ''}${uporabnik.priimek[0] ?? ''}`.toUpperCase();

  return (
    <div className="aplikacija">
      <aside className="stranska">
        <NavLink to="/" className="logotip">
          <span className="logotip-znak">⚽</span> ClubManager
        </NavLink>
        <nav className="navigacija" aria-label="Glavni meni">
          <span className="meni-naslov">Meni</span>
          <NavLink to="/" end>
            Nadzorna plošča
          </NavLink>
          <NavLink to="/treningi">Treningi</NavLink>
          <NavLink to="/tekme">Tekme</NavLink>
          {imaVlogo('IGRALEC') && (
            <NavLink to="/statistika" end>
              Moja statistika
            </NavLink>
          )}
          <NavLink to="/ekipe">Ekipe</NavLink>
          {imaVlogo('VODJA_EKIPE') && <NavLink to="/nasprotni-klubi">Nasprotni klubi</NavLink>}
          {uporabnik.jeAdministrator && (
            <>
              <span className="meni-naslov">Upravljanje</span>
              <NavLink to="/sezone">Sezone</NavLink>
              <NavLink to="/povabila">Povabila</NavLink>
            </>
          )}
        </nav>
        <button className="odjava" onClick={obOdjavi}>
          ↩ Odjava
        </button>
      </aside>
      <div className="glavni-del">
        <header className="glava">
          <NavLink to="/profil" className="glava-uporabnik">
            <span className="avatar">{zacetnici}</span>
            <span>
              <strong>
                {uporabnik.ime} {uporabnik.priimek}
              </strong>
              {uporabnik.jeAdministrator && <span className="tiho majhno"> · administrator</span>}
            </span>
          </NavLink>
        </header>
        <main className="vsebina">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
