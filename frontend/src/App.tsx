import { Route, Routes } from 'react-router-dom';
import { Postavitev } from './components/Postavitev';
import { Domov } from './pages/Domov';
import { EkipaPodrobnosti } from './pages/EkipaPodrobnosti';
import { Ekipe } from './pages/Ekipe';
import { NiNajdeno } from './pages/NiNajdeno';
import { Prijava } from './pages/Prijava';
import { ProfilStran } from './pages/Profil';
import { Sezone } from './pages/Sezone';

export function App() {
  return (
    <Routes>
      <Route path="/prijava" element={<Prijava />} />
      {/* Vse poti znotraj Postavitve so zaščitene – neprijavljen uporabnik je preusmerjen na prijavo. */}
      <Route element={<Postavitev />}>
        <Route index element={<Domov />} />
        <Route path="ekipe" element={<Ekipe />} />
        <Route path="ekipe/:id" element={<EkipaPodrobnosti />} />
        <Route path="profil" element={<ProfilStran />} />
        <Route path="uporabniki/:id" element={<ProfilStran />} />
        <Route path="sezone" element={<Sezone />} />
        <Route path="*" element={<NiNajdeno />} />
      </Route>
    </Routes>
  );
}
