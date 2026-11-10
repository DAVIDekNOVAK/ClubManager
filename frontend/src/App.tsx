import { Route, Routes } from 'react-router-dom';
import { Postavitev } from './components/Postavitev';
import { Domov } from './pages/Domov';
import { NiNajdeno } from './pages/NiNajdeno';
import { Prijava } from './pages/Prijava';

export function App() {
  return (
    <Routes>
      <Route path="/prijava" element={<Prijava />} />
      {/* Vse poti znotraj Postavitve so zaščitene – neprijavljen uporabnik je preusmerjen na prijavo. */}
      <Route element={<Postavitev />}>
        <Route index element={<Domov />} />
        <Route path="*" element={<NiNajdeno />} />
      </Route>
    </Routes>
  );
}
