# @earthos/gis

Geodesy, orbital transforms, astronomy, and spatial indexing for EarthOS.

The math layer under the globe: WGS84 geodetic conversions, the TEME/ECI to scene frame swizzle, SGP4 propagation wrappers over satellite.js, low-precision sun and moon positions, great-circle measurement, and a bucketed spatial index. Pure functions and typed arrays, no rendering or framework dependencies, so it runs on the main thread, in a worker, or in Node.

## Install

```bash
pnpm add @earthos/gis
```

The satellite.js dependency is pulled in automatically. There are no single-instance peers (react, three) to dedupe.

## Usage

```ts
import {
  parseTle,
  satGeodetic,
  geodeticToScene,
  subsolarPoint,
  observerLookAngles,
} from '@earthos/gis';

const now = Date.now();

// Sub-point (lat/lon/alt) and inertial speed of a satellite.
const sat = parseTle(tleLine1, tleLine2);
const sub = satGeodetic(sat, now); // null if SGP4 signals decay

// Place a ground marker in the earth-fixed group's local scene frame (km).
const [x, y, z] = geodeticToScene(51.48, 0, 0);

// Sunlit point on the surface, for the day/night terminator.
const sun = subsolarPoint(now);

// Azimuth / elevation / range of an object (ECEF km) from a ground station.
const look = observerLookAngles(51.48, 0, 0, satX, satY, satZ);
```

The scene frame is Y-up with 1 unit = 1 km, so earth-fixed content rides under a single group whose `rotation.y` is `gmstRad(epochMs)`. See [docs/ARCHITECTURE.md](../../docs/ARCHITECTURE.md) for the frame conventions.

Part of [EarthOS](https://github.com/efolusi/earthOS). MIT licensed.
