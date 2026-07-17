import type { FeatureCollection } from 'geojson';

/** Bundled sample shown when no URL is configured. */
export const SAMPLE: FeatureCollection = {
  type: 'FeatureCollection',
  features: [
    { type: 'Feature', properties: { name: 'Jakarta' }, geometry: { type: 'Point', coordinates: [106.8456, -6.2088] } },
    { type: 'Feature', properties: { name: 'Mount Fuji' }, geometry: { type: 'Point', coordinates: [138.7274, 35.3606] } },
    { type: 'Feature', properties: { name: 'Nairobi' }, geometry: { type: 'Point', coordinates: [36.8219, -1.2921] } },
    { type: 'Feature', properties: { name: 'Reykjavik' }, geometry: { type: 'Point', coordinates: [-21.8277, 64.1283] } },
    {
      type: 'Feature',
      properties: { name: 'Equator sample' },
      geometry: {
        type: 'LineString',
        coordinates: [
          [-30, 0],
          [-15, 0],
          [0, 0],
          [15, 0],
          [30, 0],
        ],
      },
    },
    {
      type: 'Feature',
      properties: { name: 'Bermuda Triangle' },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [-80.19, 25.76],
            [-64.75, 32.31],
            [-66.09, 18.43],
            [-80.19, 25.76],
          ],
        ],
      },
    },
  ],
};
