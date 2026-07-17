import { createRoot } from 'react-dom/client';
import { Earth, LayerSatellites, LayerDayNight } from 'earthos';

function App() {
  return (
    <Earth style={{ height: '100vh' }} initialCamera={{ lat: 20, lon: 100, altKm: 18_000 }}>
      <LayerSatellites group="stations" pointSize={6} />
      <LayerDayNight />
    </Earth>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
