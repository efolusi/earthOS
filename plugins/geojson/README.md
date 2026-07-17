# @earthos/plugin-geojson

Render any GeoJSON FeatureCollection on the EarthOS globe: points go through the shared GPU points pipeline, LineStrings and polygon outlines become a single LineSegments draw, pinned to the rotating Earth at a configurable altitude. Oversized geometries are simplified with Turf before building buffers.

Filled polygons (spherical triangulation) are a documented follow-up; outlines ship first.

## Usage

```tsx
<Layer
  manifest={() => import('@earthos/plugin-geojson')}
  settings={{ url: 'https://example.com/regions.geojson', color: '#f472b6' }}
/>
```

Blank `url` shows a bundled sample (cities, an equator line, a polygon) so the layer demos offline.

## Settings

| Key          | Default          | Notes                         |
| ------------ | ---------------- | ----------------------------- |
| `url`        | (blank = sample) | FeatureCollection URL         |
| `color`      | `#34d399`        | points + lines                |
| `pointSize`  | 5 px             |                               |
| `altitudeKm` | 8                | draw height above the surface |
