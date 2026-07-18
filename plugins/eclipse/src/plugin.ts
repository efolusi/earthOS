import { definePlugin, defineSettings, f } from '@earthos/core';

/**
 * Solar eclipse shadow: umbra disc and penumbra outline computed from
 * high-precision ephemerides, live on the simulation clock. Scrub to
 * 2026-08-12 ~17:45 UTC and watch totality cross Iceland toward Spain.
 */
export default definePlugin({
  id: 'eclipse',
  apiVersion: 1,
  meta: {
    name: 'Solar eclipse',
    category: 'astronomy',
    description: 'Umbra and penumbra of solar eclipses on the simulation clock',
    attribution: 'astronomy-engine ephemerides',
    icon: 'moon',
  },
  settings: defineSettings({
    version: 1,
    fields: {
      showPenumbra: f.boolean({ label: 'Penumbra outline', default: true }),
    },
  }),
  layer: { kind: 'scene', zOrder: 6 },
  renderer: () => import('./renderer'),
});
