# @earthos/plugin-aircraft

Live air traffic for EarthOS: ADS-B state vectors polled every ~60 s and rendered through the shared GPU points pipeline in the rotating Earth frame. Between polls each aircraft dead-reckons along its reported track and vertical rate, so the picture moves smoothly at one draw call for thousands of aircraft. The default source is [airplanes.live](https://airplanes.live) (keyless, CORS-open, viewport-scoped point queries); the OpenSky Network remains selectable for proxied global coverage.

## Usage

```tsx
<Layer manifest={() => import('@earthos/plugin-aircraft')} settings={{ showOnGround: false }} />
```

Extrapolation is clamped to ±5 minutes around the feed epoch: scrubbing the timeline far from now freezes the traffic picture instead of inventing straight-line ghost flights (a unified sim-time data contract is on the roadmap).

Click an aircraft for callsign, country of registry (from the ICAO 24-bit address when the source omits it), airframe, altitude (ft), speed (kt), heading, and vertical rate; search by callsign or ICAO 24-bit address; the follow camera tracks the dead-reckoned position.

## Settings

| Key            | Default         | Notes                                                                                   |
| -------------- | --------------- | --------------------------------------------------------------------------------------- |
| `dataSource`   | `airplaneslive` | `airplaneslive` (keyless, viewport point queries) or `opensky` (global, proxy required) |
| `pointSize`    | 3.5 px          |                                                                                         |
| `color`        | `#5EC8E6`       | sky cyan, distinct from the gold satellites                                             |
| `showOnGround` | `false`         | include taxiing aircraft                                                                |
| `maxAircraft`  | 20000           | parse cap                                                                               |
| `endpoint`     | (blank)         | custom base URL for the selected source (e.g. a self-hosted readsb or an OpenSky proxy) |

## Data sources

- **[airplanes.live](https://airplanes.live)** (default): community ADS-B aggregator, keyless, `Access-Control-Allow-Origin: *`, readsb-style `/v2/point/{lat}/{lon}/{nm}` queries capped at 250 nm around the camera. The provider refetches when the viewport settles (debounced) and honors a polite 60 s cadence.
- **[OpenSky Network](https://opensky-network.org)**: global state vectors, but its CORS policy blocks browser-direct fetches and it drops connections from cloud egress IPs (including Cloudflare Workers), so it needs a server proxy on infrastructure OpenSky accepts. The flagship app ships `/api/proxy/opensky` (optional OAuth via `OPENSKY_CLIENT_ID`/`SECRET`) for self-hosted deployments. Non-commercial use per OpenSky's [terms](https://opensky-network.org/about/terms-of-use).
