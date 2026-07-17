/** One aircraft state vector, parsed from the OpenSky states array. */
export interface AircraftState {
  icao24: string;
  callsign: string;
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
