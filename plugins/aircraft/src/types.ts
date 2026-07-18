/** One aircraft state vector, parsed from OpenSky or ADS-B v2 data. */
export interface AircraftState {
  icao24: string;
  callsign: string;
  /** origin country (OpenSky) or airframe description (ADS-B v2) */
  country: string;
  lon: number;
  lat: number;
  /** barometric (fallback geometric) altitude, meters */
  altM: number;
  onGround: boolean;
  /** ground speed, m/s */
  velocityMs: number;
  /** true track, degrees clockwise from north */
  trackDeg: number;
  /** vertical rate, m/s (+climb) */
  verticalRateMs: number;
  /** unix seconds of the position report */
  timePosition: number;
}

export interface AircraftFeed {
  /** unix seconds of the snapshot */
  time: number;
  states: AircraftState[];
}

/**
 * Raw OpenSky /states/all response: `states` is an array of positional
 * arrays, indices per https://openskynetwork.github.io/opensky-api/rest.html
 */
export interface OpenSkyRaw {
  time: number;
  states: Array<Array<string | number | boolean | null>> | null;
}

/** One aircraft in a readsb-style v2 response (airplanes.live). */
export interface AdsbV2Aircraft {
  hex: string;
  flight?: string;
  /** type designator, e.g. B38M */
  t?: string;
  /** human airframe description, e.g. BOEING 737 MAX 8 */
  desc?: string;
  alt_baro?: number | 'ground';
  alt_geom?: number;
  /** ground speed, knots */
  gs?: number;
  /** true track, degrees */
  track?: number;
  /** vertical rate, ft/min */
  baro_rate?: number;
  geom_rate?: number;
  lat?: number;
  lon?: number;
  /** seconds since the last position update */
  seen_pos?: number;
}

/** readsb-style v2 point query response ({ac, now, total}). */
export interface AdsbV2Raw {
  ac?: AdsbV2Aircraft[];
  /** snapshot time; ms in airplanes.live responses */
  now?: number;
}
