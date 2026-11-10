import { NavLink, Outlet } from 'react-router-dom';

/** Skupna postavitev strani: glava z navigacijo in vsebina. */
export function Postavitev() {
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
        </nav>
      </header>
      <main className="vsebina">
        <Outlet />
      </main>
    </div>
  );
}
