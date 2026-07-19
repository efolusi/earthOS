# @earthos/plugin-satellites

Live satellite constellations for EarthOS: the CelesTrak GP catalog (Starlink, ISS and stations, GPS, OneWeb, GEO belt, or the entire active catalog) propagated with SGP4 in a worker pool and rendered as a single GPU-extrapolated points draw call. Tested with 15,000+ objects at 60 FPS.

## Usage

```tsx
import { Earth, Layer } from 'earthos';

<Earth>
  <Layer manifest={() => import('@earthos/plugin-satellites')} settings={{ group: 'starlink' }} />
</Earth>;
```

## How it works

- `provider.ts` polls CelesTrak GP JSON every 2 hours (stale-while-revalidate, IndexedDB persistence, 72 h max age: old elements still propagate fine offline).
- `propagate.worker.ts` owns a static shard of up to 5,000 satrecs. On request it runs the satellite.js `sgp4` fast path and transfers an interleaved position+velocity `Float32Array` back.
- `renderer.tsx` feeds batches into `ExtrapolatedPointsLayer` (from `@earthos/globe`): the vertex shader extrapolates `p + v·dt - ½μp/|p|³·dt²` per frame, so the main thread pays one uniform write per frame. Shards refresh when their batch is ~15 sim-seconds old.
- Click picking runs the same extrapolation math on the CPU, so hits match pixels.
- Selecting a satellite draws its full orbit (193 SGP4 samples over ±½ period) and exposes live altitude/speed/position to the inspector; the follow camera tracks it via the globe tracker registry.
- The GP element sets carry no ownership, so country of registry is joined best-effort from CelesTrak SATCAT (`OWNER`) by NORAD id: one extra request per group, cached with the catalog, silently skipped when a custom endpoint/proxy is set or SATCAT is unreachable.

## Settings

| Key             | Default    | Notes                                            |
| --------------- | ---------- | ------------------------------------------------ |
| `group`         | `starlink` | CelesTrak GP group                               |
| `pointSize`     | 3 px       | sprite size                                      |
| `color`         | `#CE9C66`  | gold point color (distinct from other layers)    |
| `showOrbit`     | `true`     | orbit line for the selection                     |
| `maxSatellites` | 15000      | catalog cap                                      |
| `endpoint`      | (blank)    | proxy override; blank fetches CelesTrak directly |

## Data source

[CelesTrak](https://celestrak.org) GP element sets, courtesy of T.S. Kelso. Please respect their [usage guidelines](https://celestrak.org/webmaster.php); the default 2-hour refresh with jitter stays well within them. CelesTrak serves `Access-Control-Allow-Origin: *`, so browsers fetch it directly. When it is unreachable (rate-limited or cloud-blocked networks), the provider automatically degrades to the popularity-sorted [TLE API](https://tle.ivanstanojevic.me), which can also be selected explicitly via `dataSource: 'tleapi'`.
