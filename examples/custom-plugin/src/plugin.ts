import { definePlugin } from '@earthos/core';
import settings from './settings';

/**
 * The complete third-party plugin example: world capitals as a searchable,
 * clickable static layer in under 200 lines total.
 */
export default definePlugin({
  id: 'capitals',
  apiVersion: 1,
  meta: {
    name: 'World Capitals',
    category: 'custom',
    description: 'Example third-party plugin: capitals as a static layer',
  },
  settings,
  provider: () => import('./provider'),
  renderer: () => import('./renderer'),
});
