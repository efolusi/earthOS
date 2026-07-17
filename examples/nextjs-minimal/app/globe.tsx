'use client';

import { Earth, LayerSatellites, LayerEarthquakes, LayerDayNight } from 'earthos';

export function Globe() {
  return (
    <Earth style={{ height: '100vh' }} initialCamera={{ lat: 9.05, lon: 7.49, altKm: 15_000 }}>
      <LayerSatellites group="stations" showOrbit />
      <LayerEarthquakes minMagnitude={4.5} />
      <LayerDayNight />
    </Earth>
  );
}
