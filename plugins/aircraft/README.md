# @earthos/plugin-aircraft

Live global air traffic for EarthOS from the OpenSky Network: state vectors polled every ~60 s (anonymous-friendly), rendered through the shared GPU points pipeline in the rotating Earth frame. Between polls each aircraft dead-reckons along its reported track and vertical rate, so the picture moves smoothly at one draw call for ~15,000 aircraft.

## Usage

```tsx
<Layer manifest={() => import('@earthos/plugin-aircraft')} settings={{ showOnGround: false }} />
```

Extrapolation is clamped to ±5 minutes around the feed epoch: scrubbing the timeline far from now freezes the traffic picture instead of inventing straight-line ghost flights (a unified sim-time data contract is on the roadmap).

Click an aircraft for callsign, country, altitude (ft), speed (kt), heading, and vertical rate; search by callsign or ICAO 24-bit address; the follow camera tracks the dead-reckoned position.

## Settings

| Key            | Default   | Notes                                                                                                                                                                                                      |
| -------------- | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pointSize`    | 3.5 px    |                                                                                                                                                                                                            |
| `color`        | `#DFB585` | Meridian peach                                                                                                                                                                                             |
| `showOnGround` | `false`   | include taxiing aircraft                                                                                                                                                                                   |
| `maxAircraft`  | 20000     | parse cap                                                                                                                                                                                                  |
| `endpoint`     | (blank)   | proxy URL. Effectively required in browsers: OpenSky's CORS policy blocks direct cross-origin fetches. The flagship app ships `/api/proxy/opensky` (with optional OAuth via `OPENSKY_CLIENT_ID`/`SECRET`). |

## Data source

[OpenSky Network](https://opensky-network.org) REST API. Anonymous access has a small daily credit budget and ~10 s resolution; the default policy (60 s + jitter, last-good on errors, Retry-After honored) stays within it. For production traffic, register an OpenSky account and proxy authenticated requests via the `endpoint` setting. Data is for non-commercial use per OpenSky's [terms](https://opensky-network.org/about/terms-of-use).
