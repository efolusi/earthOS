import type { Feature, FeatureCollection, Position } from 'geojson';
import simplify from '@turf/simplify';
import { geodeticToScene } from '@earthos/gis';

export interface BuiltGeometry {
  /** Point features: interleaved pos+vel (vel zero) for the points layer. */
  pointsPosVel: Float32Array;
  pointLabels: string[];
  pointCoords: Array<[number, number]>; // lon, lat
  /** Line segments (pairs of vertices) for one LineSegments draw. */
  linePositions: Float32Array;
}

const MAX_POINTS = 50_000;
const MAX_LINE_VERTICES = 400_000;
/** Simplify line/polygon features beyond this many coordinates. */
const SIMPLIFY_THRESHOLD = 5_000;

function featureName(feature: Feature, index: number): string {
  const props = feature.properties ?? {};
  const name = props.name ?? props.NAME ?? props.title ?? props.id;
  return typeof name === 'string' && name.length > 0 ? name : `Feature ${index + 1}`;
}

function countCoords(feature: Feature): number {
  const g = feature.geometry;
  if (!g) return 0;
  switch (g.type) {
    case 'LineString':
      return g.coordinates.length;
    case 'MultiLineString':
    case 'Polygon':
      return g.coordinates.reduce((a, ring) => a + ring.length, 0);
    case 'MultiPolygon':
      return g.coordinates.reduce((a, poly) => a + poly.reduce((b, ring) => b + ring.length, 0), 0);
    default:
      return 0;
  }
}

/**
 * Convert a FeatureCollection into scene-space typed arrays: points feed the
 * shared points pipeline; lines and polygon OUTLINES become one LineSegments
 * buffer. (Filled polygons need spherical triangulation: documented as a
 * follow-up, outlines ship first.)
 */
export function buildGeometry(collection: FeatureCollection, altitudeKm: number): BuiltGeometry {
  const pointScene: number[] = [];
  const pointLabels: string[] = [];
  const pointCoords: Array<[number, number]> = [];
  const lineScene: number[] = [];
  const scratch: [number, number, number] = [0, 0, 0];

  const pushPoint = (pos: Position, label: string) => {
    if (pointLabels.length >= MAX_POINTS) return;
    const [lon, lat] = pos;
    if (typeof lon !== 'number' || typeof lat !== 'number') return;
    geodeticToScene(lat, lon, altitudeKm, scratch);
    pointScene.push(scratch[0], scratch[1], scratch[2], 0, 0, 0);
    pointLabels.push(label);
    pointCoords.push([lon, lat]);
  };

  const pushLine = (coords: Position[]) => {
    for (let i = 0; i + 1 < coords.length; i++) {
      if (lineScene.length / 3 >= MAX_LINE_VERTICES) return;
      for (const pos of [coords[i]!, coords[i + 1]!]) {
        const [lon, lat] = pos;
        geodeticToScene(lat as number, lon as number, altitudeKm, scratch);
        lineScene.push(scratch[0], scratch[1], scratch[2]);
      }
    }
  };

  collection.features.forEach((rawFeature, index) => {
    let feature = rawFeature;
    if (countCoords(feature) > SIMPLIFY_THRESHOLD) {
      try {
        feature = simplify(feature as never, { tolerance: 0.05, highQuality: false }) as Feature;
      } catch {
        // keep the original when turf rejects the geometry
      }
    }
    const g = feature.geometry;
    if (!g) return;
    const label = featureName(feature, index);
    switch (g.type) {
      case 'Point':
        pushPoint(g.coordinates, label);
        break;
      case 'MultiPoint':
        g.coordinates.forEach((c) => pushPoint(c, label));
        break;
      case 'LineString':
        pushLine(g.coordinates);
        break;
      case 'MultiLineString':
        g.coordinates.forEach(pushLine);
        break;
      case 'Polygon':
        g.coordinates.forEach(pushLine);
        break;
      case 'MultiPolygon':
        g.coordinates.forEach((poly) => poly.forEach(pushLine));
        break;
      case 'GeometryCollection':
        // Rare; skipped in v1 to keep the walker simple.
        break;
    }
  });

  return {
    pointsPosVel: new Float32Array(pointScene),
    pointLabels,
    pointCoords,
    linePositions: new Float32Array(lineScene),
  };
}
