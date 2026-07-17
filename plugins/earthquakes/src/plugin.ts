import { definePlugin } from '@earthos/core';
import settings from './settings';

export default definePlugin({
  id: 'earthquakes',
  apiVersion: 1,
  meta: {
    name: 'Earthquakes',
    category: 'geophysical',
    description: 'Live seismic events, magnitude-scaled and depth-colored',
    attribution: 'USGS',
    icon: 'activity',
  },
  settings,
  layer: { kind: 'scene', zOrder: 20 },
  provider: () => import('./provider'),
  renderer: () => import('./renderer'),
});
