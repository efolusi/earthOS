/** NASA EONET v3 event shapes (the subset we consume). */
export interface EonetGeometry {
  date: string;
  type: string;
  /** [lon, lat] for Point, [lon, lat] rings for Polygon */
  coordinates: number[] | number[][][];
}

export interface EonetEvent {
  id: string;
  title: string;
  /** ordered track; the last entry is the most recent position */
  geometry: EonetGeometry[];
}

export interface EonetResponse {
  events: EonetEvent[];
}

/** One active fire, flattened to its most recent point. */
export interface Wildfire {
  id: string;
  title: string;
  lat: number;
  lon: number;
  /** ms epoch of the most recent detection */
  date: number;
}

export interface WildfireFeed {
  fires: Wildfire[];
}
