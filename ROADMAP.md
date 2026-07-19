# EarthOS Roadmap

> Prioritized against the field in [docs/COMPETITIVE_ANALYSIS.md](docs/COMPETITIVE_ANALYSIS.md).
> Shipped from that list: ✅ measurement tools (distance/area), ✅ wildfire layer
> (NASA EONET), ✅ mobile/responsive pass.
> Next bets (impact ÷ effort): guided tour + featured views, KML/Shapefile import,
> persistent watchlist + basemap picker, live GOES/Himawari cloud imagery, observer
> pass prediction, richer aircraft panels, DEM terrain relief.

## Now (foundation, M0-M6)

- [x] Monorepo, presets, CI, release pipeline
- [x] `@earthos/core`: plugin runtime, TimeEngine, WorkerPool, stores
- [x] `@earthos/globe`: shader globe, camera, 100k points pipeline
- [x] `@earthos/providers`: caching/polling/rate-limit framework
- [x] Flagship plugins: satellites (CelesTrak), earthquakes (USGS), day/night, GeoJSON
- [x] Catalog plugins shipped since: imagery (Esri / EOX Sentinel-2), eclipse
      (astronomy-engine), aircraft (airplanes.live default, OpenSky optional),
      hurricanes (NOAA NHC), wildfires (NASA EONET). Nine plugins register in the
      flagship app.
- [x] `@earthos/ui` + flagship app: layer panel, inspector, timeline, command palette
- [x] `earthos` SDK + `create-earthos-plugin` + docs + examples

## Next (plugin catalog)

Each entry lists its data source and provider policy. All are open for contribution; the nine shipped plugins above are the working reference.

| Plugin                               | Source                                | Provider type                     | Notes                                                |
| ------------------------------------ | ------------------------------------- | --------------------------------- | ---------------------------------------------------- |
| ships                                | AIS (aisstream.io or self-hosted)     | Stream (WebSocket)                | worker-side aggregation to 1 Hz snapshots            |
| weather                              | OpenWeather                           | Tile                              | key via proxy endpoint                               |
| wind                                 | NOAA GFS                              | Polling 6 h aligned to model runs | GRIB decode in worker, particle layer                |
| rain / clouds (live)                 | RainViewer / GIBS                     | Tile                              |                                                      |
| lightning                            | Blitzortung                           | Stream                            |                                                      |
| volcanoes                            | Smithsonian GVP                       | Static weekly                     |                                                      |
| tsunami                              | NOAA                                  | Polling                           |                                                      |
| aurora                               | NOAA SWPC OVATION                     | Polling 30 min                    | oval overlay                                         |
| air quality                          | OpenAQ                                | Polling, viewport-scoped          |                                                      |
| ocean temperature / currents         | NOAA / Copernicus                     | Tile / polling                    |                                                      |
| city lights                          | NASA Black Marble                     | Static tiles                      | already a globe texture; plugin adds intensity layer |
| population                           | SEDAC GPW                             | Static tiles                      |                                                      |
| internet cables                      | TeleGeography (public geojson mirror) | Static                            |                                                      |
| ground stations                      | SatNOGS                               | Static daily                      |                                                      |
| data centers                         | community dataset                     | Static                            |                                                      |
| space debris                         | CelesTrak (debris groups)             | Polling 6 h                       | same pipeline as satellites                          |
| GPS / OneWeb / Kuiper constellations | CelesTrak groups                      | Polling 2 h                       | presets over the satellites plugin                   |
| ISS / Hubble featured tracking       | CelesTrak                             | Polling                           | curated entity presets + follow camera               |
| terrain                              | AWS Terrain Tiles / MapTiler          | Tile                              | needs tiled-patch renderer (below)                   |
| buildings                            | OpenStreetMap                         | Tile                              | far-future, city zoom                                |

## Later (platform)

- Unified sim-time/data-time contract: feeds are wall-clock; scrubbed sim time currently clamps dead-reckoned layers (aircraft freeze beyond ±5 min) and leaves snapshot layers (earthquakes) un-filtered by sim epoch
- Analytics suite: pass prediction, line of sight, coverage, constellation statistics, heatmaps (built on GeoGrid)
- Bookmarks: saved named views on top of the shareable camera/time/layer permalinks that already ship
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
