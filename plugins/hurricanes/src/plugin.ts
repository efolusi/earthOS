import { definePlugin } from '@earthos/core';
import settings from './settings';

export default definePlugin({
  id: 'hurricanes',
  apiVersion: 1,
  meta: {
    name: 'Hurricanes',
    category: 'weather',
    description: 'Active tropical cyclones, intensity-scaled',
    attribution: 'NOAA NHC',
    icon: 'wind',
  },
  settings,
  layer: { kind: 'scene', zOrder: 22 },
  provider: () => import('./provider'),
  renderer: () => import('./renderer'),
});
