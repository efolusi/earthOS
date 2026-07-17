/** USGS GeoJSON summary feed shapes (subset we consume). */
export interface UsgsFeature {
  id: string;
  properties: {
    mag: number | null;
    place: string | null;
    time: number;
    updated: number;
    url: string;
    type: string;
  };
  geometry: {
    type: 'Point';
    /** [lon, lat, depthKm] */
    coordinates: [number, number, number];
  };
}

export interface QuakeFeed {
  metadata: { generated: number; title: string };
  features: UsgsFeature[];
}

export type FeedWindow = 'all_hour' | 'all_day' | 'all_week' | 'all_month';
