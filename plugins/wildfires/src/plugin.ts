import { definePlugin } from '@earthos/core';
import settings from './settings';

export default definePlugin({
  id: 'wildfires',
  apiVersion: 1,
  meta: {
    name: 'Wildfires',
    category: 'geophysical',
    description: 'Active fire events from NASA EONET',
    attribution: 'NASA EONET',
    icon: 'flame',
  },
  settings,
  layer: { kind: 'scene', zOrder: 22 },
  provider: () => import('./provider'),
  renderer: () => import('./renderer'),
});
