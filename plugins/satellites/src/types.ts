/**
 * CelesTrak GP record (OMM JSON). Field names follow the CCSDS OMM standard
 * as served by https://celestrak.org/NORAD/elements/gp.php?FORMAT=json.
 */
export interface OmmRecord {
  OBJECT_NAME: string;
  OBJECT_ID: string;
  EPOCH: string;
  MEAN_MOTION: number;
  ECCENTRICITY: number;
  INCLINATION: number;
  RA_OF_ASC_NODE: number;
  ARG_OF_PERICENTER: number;
  MEAN_ANOMALY: number;
  EPHEMERIS_TYPE: number;
  CLASSIFICATION_TYPE: string;
  NORAD_CAT_ID: number;
  ELEMENT_SET_NO: number;
  REV_AT_EPOCH: number;
  BSTAR: number;
  MEAN_MOTION_DOT: number;
  MEAN_MOTION_DDOT: number;
  /** Owner/country of registry, joined from SATCAT (not in the GP feed itself). */
  country?: string;
}

/** Minimal record from TLE-line sources (tle.ivanstanojevic.me and kin). */
export interface TleRecord {
  OBJECT_NAME: string;
  NORAD_CAT_ID: number;
  TLE_LINE1: string;
  TLE_LINE2: string;
  /** Owner/country of registry, joined from SATCAT when available. */
  country?: string;
}

export type CatalogRecord = OmmRecord | TleRecord;

export function isTleRecord(record: CatalogRecord): record is TleRecord {
  return 'TLE_LINE1' in record;
}

export type SatCatalog = CatalogRecord[];

export type CatalogGroup =
  'starlink' | 'active' | 'stations' | 'gps-ops' | 'oneweb' | 'geo' | 'weather' | 'science';

/** Worker protocol. */
export interface InitPayload {
  records: CatalogRecord[];
}

export interface InitResult {
  /** How many records parsed into usable satrecs. */
  parsed: number;
  total: number;
}

export interface PropagatePayload {
  epochMs: number;
}

export interface PropagateResult {
  epochMs: number;
  /** interleaved scene-frame x,y,z,vx,vy,vz per record (km, km/s) */
  buffer: Float32Array;
  /** 1 = valid state, 0 = decayed/unparsed (hide it) */
  valid: Uint8Array;
}
