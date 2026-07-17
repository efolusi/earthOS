import { describe, expect, it } from 'vitest';
import { buildGeometry } from '../src/build-geometry';
import { SAMPLE } from '../src/sample';
import { EARTH_RADIUS_KM } from '@earthos/gis';

describe('buildGeometry', () => {
  it('converts the bundled sample into points and line segments', () => {
    const built = buildGeometry(SAMPLE, 8);
    expect(built.pointLabels).toEqual(['Jakarta', 'Mount Fuji', 'Nairobi', 'Reykjavik']);
    expect(built.pointsPosVel.length).toBe(4 * 6);
    // 4-segment equator line (8 verts) + 3-segment polygon outline (6 verts)
    expect(built.linePositions.length / 3).toBe(8 + 6);
  });

  it('places every vertex near the requested altitude', () => {
    const alt = 100;
    const built = buildGeometry(SAMPLE, alt);
    for (let i = 0; i < built.linePositions.length; i += 3) {
      const r = Math.hypot(
        built.linePositions[i]!,
        built.linePositions[i + 1]!,
        built.linePositions[i + 2]!,
      );
      // WGS84 flattening keeps radii within ~21 km of the sphere + altitude.
      expect(Math.abs(r - (EARTH_RADIUS_KM + alt))).toBeLessThan(30);
    }
  });

  it('names unnamed features by index and handles MultiPoint', () => {
    const built = buildGeometry(
      {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'MultiPoint',
              coordinates: [
                [0, 10],
                [20, 30],
              ],
            },
          },
        ],
      },
      8,
    );
    expect(built.pointLabels).toEqual(['Feature 1', 'Feature 1']);
  });
});
