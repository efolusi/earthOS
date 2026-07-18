import { definePlugin } from '@earthos/core';
import settings from './settings';

export default definePlugin({
  id: 'geojson',
  apiVersion: 1,
  meta: {
    name: 'Custom GeoJSON',
    category: 'custom',
    description: 'Render any GeoJSON FeatureCollection on the globe',
    icon: 'map',
    color: '#5FB86E',
  },
  settings,
  layer: { kind: 'scene', zOrder: 30 },
  provider: () => import('./provider'),
  renderer: () => import('./renderer'),
});
