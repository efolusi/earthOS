import { definePlugin } from '@earthos/core';
import settings from './settings';

/**
 * Fully computed layer: no provider, no network. The minimal proof of the
 * plugin shape (manifest + renderer + settings only).
 */
export default definePlugin({
  id: 'daynight',
  apiVersion: 1,
  meta: {
    name: 'Day / Night',
    category: 'astronomy',
    description: 'Terminator line with subsolar and sublunar markers',
    icon: 'sun',
  },
  settings,
  layer: { kind: 'scene', zOrder: 5 },
  renderer: () => import('./renderer'),
});
