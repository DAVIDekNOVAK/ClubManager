import { Route, Routes } from 'react-router-dom';
import { Postavitev } from './components/Postavitev';
import { Domov } from './pages/Domov';
import { NiNajdeno } from './pages/NiNajdeno';

export function App() {
  return (
    <Routes>
      <Route element={<Postavitev />}>
        <Route index element={<Domov />} />
        <Route path="*" element={<NiNajdeno />} />
      </Route>
    </Routes>
  );
}
