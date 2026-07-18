import { definePlugin } from '@earthos/core';
import settings from './settings';

export default definePlugin({
  id: 'aircraft',
  apiVersion: 1,
  meta: {
    name: 'Aircraft',
    category: 'aviation',
    description: 'Live ADS-B traffic, dead-reckoned along track between polls',
    attribution: 'airplanes.live / OpenSky Network',
    icon: 'plane',
    color: '#4FC3E8',
  },
  settings,
  layer: { kind: 'scene', zOrder: 15 },
  provider: () => import('./provider'),
  renderer: () => import('./renderer'),
});
