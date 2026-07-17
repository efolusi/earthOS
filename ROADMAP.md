# EarthOS Roadmap

## Now (foundation, M0-M6)

- [x] Monorepo, presets, CI, release pipeline
- [ ] `@earthos/core`: plugin runtime, TimeEngine, WorkerPool, stores
- [ ] `@earthos/globe`: shader globe, floating origin, 100k points pipeline
- [ ] `@earthos/providers`: caching/polling/rate-limit framework
- [ ] Flagship plugins: satellites (CelesTrak), earthquakes (USGS), day/night, GeoJSON
- [ ] `@earthos/ui` + flagship app: layer panel, inspector, timeline, command palette
- [ ] `earthos` SDK + `create-earthos-plugin` + docs + examples

## Next (plugin catalog)

Each entry lists its data source and provider policy. All are open for contribution; the pattern is proven by the flagship four.

| Plugin | Source | Provider type | Notes |
|---|---|---|---|
| aircraft | OpenSky | Polling 10 s, viewport-scoped, rate-limited | anonymous works, OAuth via proxy |
| ships | AIS (aisstream.io or self-hosted) | Stream (WebSocket) | worker-side aggregation to 1 Hz snapshots |
| weather | OpenWeather | Tile | key via proxy endpoint |
| wind | NOAA GFS | Polling 6 h aligned to model runs | GRIB decode in worker, particle layer |
| rain / clouds (live) | RainViewer / GIBS | Tile | |
| hurricanes | NOAA NHC | Polling | cone + track rendering |
| lightning | Blitzortung | Stream | |
| wildfires | NASA FIRMS | Polling 1 h | |
| volcanoes | Smithsonian GVP | Static weekly | |
| tsunami | NOAA | Polling | |
| aurora | NOAA SWPC OVATION | Polling 30 min | oval overlay |
| air quality | OpenAQ | Polling, viewport-scoped | |
| ocean temperature / currents | NOAA / Copernicus | Tile / polling | |
| city lights | NASA Black Marble | Static tiles | already a globe texture; plugin adds intensity layer |
| population | SEDAC GPW | Static tiles | |
| internet cables | TeleGeography (public geojson mirror) | Static | |
| ground stations | SatNOGS | Static daily | |
| data centers | community dataset | Static | |
| space debris | CelesTrak (debris groups) | Polling 6 h | same pipeline as satellites |
| GPS / OneWeb / Kuiper constellations | CelesTrak groups | Polling 2 h | presets over the satellites plugin |
| ISS / Hubble featured tracking | CelesTrak | Polling | curated entity presets + follow camera |
| terrain | AWS Terrain Tiles / MapTiler | Tile | needs tiled-patch renderer (below) |
| buildings | OpenStreetMap | Tile | far-future, city zoom |

## Later (platform)

- Analytics suite: pass prediction, line of sight, coverage, constellation statistics, heatmaps (built on GeoGrid)
- Bookmarks + shareable camera/time/layer permalinks
- MapLibre 2D fallback mode
- Tiled surface patches with per-tile origins (street-level zoom)
- Bruneton precomputed atmospheric scattering
- HDR pipeline + selective bloom
- Space-Track authenticated catalog sync
- Plugin marketplace/registry discovery (`keywords: ["earthos-plugin"]`)

## Design principles that gate everything above

1. Every data source is a plugin with the mandated file shape.
2. Disabled plugins cost zero bytes.
3. Nothing per-frame goes through React or zustand.
4. API keys never ship client-side.
