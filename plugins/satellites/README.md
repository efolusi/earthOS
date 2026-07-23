# @earthos/plugin-satellites

Live satellite constellations for EarthOS: the CelesTrak GP catalog (Starlink, ISS and stations, GPS, OneWeb, GEO belt, weather satellites, science missions, or the entire active catalog) propagated with SGP4 in a worker pool and rendered as a single GPU-extrapolated points draw call. Tested with 15,000+ objects at 60 FPS.

## Install

```sh
pnpm add @earthos/plugin-satellites
```

Single-instance peer dependencies, provided by the host app: `@earthos/globe`, `@react-three/fiber` (v9), `react` (v19), and `three` (>=0.170).

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

| Key             | Default     | Notes                                                          |
| --------------- | ----------- | -------------------------------------------------------------- |
| `dataSource`    | `celestrak` | `celestrak` (grouped catalog) or `tleapi` (popular satellites) |
| `group`         | `starlink`  | CelesTrak GP group                                             |
| `exclude`       | (blank)     | comma-separated name terms to hide, e.g. `starlink`            |
| `pointSize`     | 3 px        | sprite size                                                    |
| `color`         | `#E3B34D`   | gold point color (distinct from other layers)                  |
| `showOrbit`     | `true`      | orbit line for the selection                                   |
| `maxSatellites` | 15000       | catalog cap                                                    |
| `endpoint`      | (blank)     | proxy override; blank fetches CelesTrak directly               |

### Hiding a constellation

The `active` group is roughly 80% Starlink, so everything else is buried under it.
Set `exclude` to see the rest:

```ts
settings: { group: 'active', exclude: 'starlink' }   // everything except Starlink
settings: { group: 'active', exclude: 'starlink, oneweb' }
```

Terms are matched case-insensitively as substrings of `OBJECT_NAME`. Filtering runs
before the catalog is sharded into the SGP4 workers, so hidden objects cost no
propagation, and it re-derives from the catalog already in memory, so changing the
filter is instant and never refetches the group.

## Data source

[CelesTrak](https://celestrak.org) GP element sets, courtesy of T.S. Kelso. Please respect their [usage guidelines](https://celestrak.org/webmaster.php); the default 2-hour refresh with jitter stays well within them. CelesTrak serves `Access-Control-Allow-Origin: *`, so browsers fetch it directly. When it is unreachable (rate-limited or cloud-blocked networks), the provider automatically degrades to the popularity-sorted [TLE API](https://tle.ivanstanojevic.me), which can also be selected explicitly via `dataSource: 'tleapi'`.

See [docs/PLUGIN_GUIDE.md](../../docs/PLUGIN_GUIDE.md) for the layer contract.

Part of [EarthOS](https://github.com/efolusi/earthOS). MIT licensed.
