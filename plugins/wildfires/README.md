# @earthos/plugin-wildfires

Active wildfire events for EarthOS from [NASA EONET](https://eonet.gsfc.nasa.gov) (Earth Observatory Natural Event Tracker): keyless, CORS-open, curated from many satellite fire sources. Each event is a track; the layer plots its most recent detection as a fire-heat point through the shared GPU points pipeline in the rotating Earth frame.

## Usage

```tsx
<Layer
  manifest={() => import('@earthos/plugin-wildfires')}
  settings={{ status: 'open', days: 10 }}
/>
```

Click a fire for its title, last-detected time, and coordinates; search by name; the follow camera tracks it. Points are colored by recency (bright orange < 2 days, amber < 7 days, dimmer beyond) so fresh fires stand out — a fire-heat ramp distinct from the earthquake red and hurricane violet.

## Settings

| Key         | Default   | Notes                                                    |
| ----------- | --------- | -------------------------------------------------------- |
| `status`    | `open`    | active-only, or include recently-closed events           |
| `days`      | 10        | only events with a detection in this window (1–60)       |
| `pointSize` | 7 px      |                                                          |
| `color`     | `#FF7518` | fresh-fire color (older tiers derive from the heat ramp) |
| `endpoint`  | (blank)   | custom EONET base URL                                    |

## Data source

[NASA EONET v3](https://eonet.gsfc.nasa.gov/docs/v3). EONET curates natural events (wildfires, volcanoes, storms) rather than every thermal hotspot, so this is a clean overview layer, not a per-pixel fire-detection feed (that would be [NASA FIRMS](https://firms.modaps.eosdis.nasa.gov), which requires a free MAP_KEY). Keyless and `Access-Control-Allow-Origin: *`; polled every ~10 minutes.
