import { Route, Routes } from 'react-router-dom';
import { Postavitev } from './components/Postavitev';
import { Domov } from './pages/Domov';
import { EkipaPodrobnosti } from './pages/EkipaPodrobnosti';
import { Ekipe } from './pages/Ekipe';
import { NasprotniKlubi } from './pages/NasprotniKlubi';
import { NiNajdeno } from './pages/NiNajdeno';
import { Povabila } from './pages/Povabila';
import { Prijava } from './pages/Prijava';
import { Prisotnost } from './pages/Prisotnost';
import { Registracija } from './pages/Registracija';
import { ProfilStran } from './pages/Profil';
import { Sezone } from './pages/Sezone';
import { TekmaPodrobnosti } from './pages/TekmaPodrobnosti';
import { Tekme } from './pages/Tekme';
import { Treningi } from './pages/Treningi';
import { TreningPodrobnosti } from './pages/TreningPodrobnosti';

export function App() {
  return (
    <Routes>
      <Route path="/prijava" element={<Prijava />} />
      <Route path="/povabilo/:zeton" element={<Registracija />} />
      {/* Vse poti znotraj Postavitve so zaščitene – neprijavljen uporabnik je preusmerjen na prijavo. */}
      <Route element={<Postavitev />}>
        <Route index element={<Domov />} />
        <Route path="ekipe" element={<Ekipe />} />
        <Route path="ekipe/:id" element={<EkipaPodrobnosti />} />
        <Route path="profil" element={<ProfilStran />} />
        <Route path="uporabniki/:id" element={<ProfilStran />} />
        <Route path="treningi" element={<Treningi />} />
        <Route path="treningi/:id" element={<TreningPodrobnosti />} />
        <Route path="treningi/:id/prisotnost" element={<Prisotnost />} />
        <Route path="tekme" element={<Tekme />} />
        <Route path="tekme/:id" element={<TekmaPodrobnosti />} />
        <Route path="nasprotni-klubi" element={<NasprotniKlubi />} />
        <Route path="sezone" element={<Sezone />} />
        <Route path="povabila" element={<Povabila />} />
        <Route path="*" element={<NiNajdeno />} />
      </Route>
    </Routes>
  );
}
