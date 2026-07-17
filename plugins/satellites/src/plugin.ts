import { definePlugin } from '@earthos/core';
import settings from './settings';

/**
 * The satellites layer: CelesTrak GP catalog (Starlink, ISS, GPS, the whole
 * active catalog) propagated with SGP4 in a worker pool and rendered as one
 * GPU-extrapolated points draw call.
 *
 * This manifest is the ONLY statically-imported module of the plugin;
 * provider and renderer are dynamic-import split points, so the plugin costs
 * zero bytes while disabled.
 */
export default definePlugin({
  id: 'satellites',
  apiVersion: 1,
  meta: {
    name: 'Satellites',
    category: 'satellites',
    description: 'Live satellite constellations propagated with SGP4',
    attribution: 'CelesTrak',
    icon: 'satellite',
  },
  settings,
  layer: { kind: 'scene', zOrder: 10 },
  provider: () => import('./provider'),
  renderer: () => import('./renderer'),
});
