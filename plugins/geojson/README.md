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

### Real-data example

A hosted sample dataset is served alongside the flagship app for trying the layer against real points:

```tsx
<Layer
  manifest={() => import('@earthos/plugin-geojson')}
  settings={{ url: 'https://earthos.efolusi.com/samples/kdmp-merah-putih-sample.geojson' }}
/>
```

1,900 Koperasi Desa/Kelurahan Merah Putih (KDMP) candidate locations, geographically stratified across Indonesia. Each point is a village centroid from Badan Informasi Geospasial (BIG), so it marks where a cooperative is mandated, not a verified per-cooperative address or an official registry. Provenance, vintage and reuse terms are in `apps/web/public/samples/CREDITS.md`; BIG declares no open-data licence, so confirm terms with BIG before redistributing.

## Settings

| Key          | Default          | Notes                         |
| ------------ | ---------------- | ----------------------------- |
| `url`        | (blank = sample) | FeatureCollection URL         |
| `color`      | `#5FB86E`        | points + lines                |
| `pointSize`  | 5 px             |                               |
| `altitudeKm` | 8                | draw height above the surface |
