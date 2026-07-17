# @earthos/plugin-earthquakes

Live seismic events from the USGS GeoJSON summary feeds, rendered as magnitude-scaled, depth-colored markers pinned to the rotating Earth. Polls every 60 s (jittered), keeps last-good data through outages, and persists to IndexedDB.

## Usage

```tsx
<Layer manifest={() => import('@earthos/plugin-earthquakes')} settings={{ feed: 'all_week', minMagnitude: 4.5 }} />
```

## Settings

| Key | Default | Notes |
|---|---|---|
| `feed` | `all_day` | USGS window: `all_hour` / `all_day` / `all_week` / `all_month` |
| `minMagnitude` | 2.5 | client-side filter |
| `endpoint` | (blank) | proxy override |

Colors: red = shallow (< 70 km), orange = intermediate (< 300 km), violet = deep focus. Click a marker for place, time, depth, and a link to the USGS event page.

## Data source

[USGS Earthquake Hazards Program](https://earthquake.usgs.gov/earthquakes/feed/v1.0/geojson.php), public domain.
