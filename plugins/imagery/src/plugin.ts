import { definePlugin } from '@earthos/core';
import settings from './settings';

/**
 * Streaming tiled imagery: the zoom-sharpness fix. A web-mercator quadtree
 * refines against screen-space error and drapes curved, sun-lit tile meshes
 * over the globe, so detail scales with zoom the way slippy maps do instead
 * of being capped by one global texture.
 */
export default definePlugin({
  id: 'imagery',
  apiVersion: 1,
  meta: {
    name: 'Satellite imagery',
    category: 'infrastructure',
    description: 'Streamed high-resolution imagery tiles (zoom for detail)',
    attribution: 'Esri / EOX Sentinel-2',
    icon: 'globe',
  },
  settings,
  layer: { kind: 'tile', zOrder: 1 },
  provider: () => import('./provider'),
  renderer: () => import('./renderer'),
});
