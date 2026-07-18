export interface Storm {
  id: string;
  name: string;
  /** SS = subtropical, TD, TS, HU, etc. */
  classification: string;
  lat: number;
  lon: number;
  /** max sustained winds, knots */
  intensityKt: number;
  movementDir: number | null;
  movementKt: number | null;
  lastUpdate: string;
}

export interface StormFeed {
  storms: Storm[];
}
