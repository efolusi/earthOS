<!-- Generated 2026-07-18 from an 8-competitor research pass (satellitemap.space, Google Earth, NASA Eyes, Flightradar24, Windy, Zoom.Earth, keeptrack.space, CesiumJS). Living document — prune items as they ship. -->

# EarthOS Competitive Gap Analysis

Synthesized from 8 competitors: satellitemap.space, Google Earth (web), NASA Eyes, Flightradar24, Windy.com, Zoom.Earth, KeepTrack.space, and CesiumJS. Gaps deduplicated and grouped into themes. Impact/effort are as scored in source research, reconciled where competitors disagreed.

A note on the shape of the field: every single competitor beats EarthOS on **mobile/responsive** and **onboarding/discovery**. Those two are the universal gaps. Everything else is domain depth where one or two rivals go far deeper than EarthOS's "dots on a globe."

---

## Theme 1: Mobile & Responsive (the universal gap)

| Gap | Who has it | Impact | Effort | How EarthOS could do it |
|---|---|---|---|---|
| Touch/responsive UX; no desktop-only wall | **All 8** | High | Large | Touch camera handlers (pinch/pan/rotate with inertia), reflow the dense R3F HUD/panels, mobile-GPU perf budget. PWA-first responsive pass, not native apps. Even a read-only reduced-layer mobile view closes most of the practical gap. |
| Augmented-reality "point at the sky to ID" | FR24, satellitemap.space | Med | Large | Device orientation + camera; niche, gate behind the responsive pass. |

This is called out in EarthOS's own capability notes. It is the single biggest reach limiter: for a consumer "go look up at the sky" or "check the weather" product, mobile is where the usage actually is.

---

## Theme 2: Onboarding & Discovery (universal, cheap, neglected)

| Gap | Who has it | Impact | Effort | How EarthOS could do it |
|---|---|---|---|---|
| Guided first-run tour | Google (Voyager), NASA Eyes, KeepTrack, Cesium | High | Small–Med | Scripted sequence of existing permalink states (camera + time + layers) + captions. A JSON tour format also invites community-authored tours (OSS advantage). |
| Curated "featured views" gallery | Google, Cesium, NASA Eyes | Med | Small | A menu of preset permalinks (ISS pass, live hurricane, Starlink shell, eclipse). Pure UI over existing permalink system. |
| Contextual "what is this / why it matters" blurbs + featured-events feed | NASA Eyes | Med | Small | Attach plain-language context to existing quake/hurricane inspect panels; auto-build an events feed from the USGS/NHC feeds already ingested. |
| Favoritable/reorderable layer panel + activity presets | Windy | Low | Small | Cheap polish over the existing plugin registry; meaningfully improves first-run comprehension vs cmdk-only discovery. |
| Per-topic SEO landing pages | satellitemap.space, FR24 | Med | Med | Pre-rendered/SSR entry pages (Starlink tracker, earthquakes, re-entries) that deep-link into the globe. EarthOS is a single SPA with near-zero organic discovery. |

Discovery is EarthOS's weakest non-technical area: cmdk search is powerful but assumes you already know what to look for.

---

## Theme 3: Interaction & Analysis Tools

| Gap | Who has it | Impact | Effort | How EarthOS could do it |
|---|---|---|---|---|
| Distance / area / elevation-profile measurement | Google, Zoom.Earth, Cesium | High | Med | Great-circle distance + spherical polygon area need no new data (small); elevation profiles need the DEM layer (Theme 5). Highest utility-to-effort win in the set. |
| Live value "picker" (sample a scalar field at cursor) | Windy | High | Med | Sample source texture/grid at lat/lon under cursor. Only meaningful once a raster data layer exists. |
| In-app draw/annotate (points, lines, polygons, placemarks) | Google, Cesium | Med | Med | Draw mode emits GeoJSON into the existing renderer; serialize into the permalink for account-less sharing. Pairs naturally with measure tools. |
| Broad file import: KML/KMZ, Shapefile | Google | Med | Small | Client-side `togeojson` + `shpjs` convert to the GeoJSON the custom layer already renders. Lowest-effort item; instantly widens the GIS/planning audience. |
| Meteogram / point time-series | Windy, Zoom.Earth | Med | Med | Reuse the sim clock's time axis to plot model values at a picked coordinate. |
| Per-location point forecast (tap → daily/hourly) | Zoom.Earth | Med | Med | Wire Open-Meteo into the existing click/search flow. |

---

## Theme 4: Data & Layers — Weather

EarthOS renders a synthetic/static cloud texture and nothing numerical. Windy and Zoom.Earth are built entirely on this. This is a whole product category EarthOS is absent from.

| Gap | Who has it | Impact | Effort | How EarthOS could do it |
|---|---|---|---|---|
| Numerical forecast overlays (wind, temp, precip, pressure, humidity) | Windy, Zoom.Earth | High | Large | GRIB/NetCDF ingest (GFS/ICM/ECMWF, or Open-Meteo tiles) → texture tiles → color-mapped shader. The sim clock already scrubs into the future, so it plugs straight into existing time infra. Heaviest lift, biggest single differentiator. A 3D globe showcases global fields better than Windy's 2D map. |
| Animated wind particle flow field | Windy | High | Large | GPU particle advection over a UV-sampled vector field on the sphere. Build alongside the forecast pipeline — same data. Standout visual on a globe. |
| Live observed geostationary cloud imagery (GOES/Himawari/Meteosat, 10–15 min loops) | Zoom.Earth | High | Med | NOAA GOES / NASA GIBS serve time-stamped tiles that fit the existing quadtree streamer. Mostly wiring a time-indexed cloud source to the clock. Replaces the fake cloud texture with real weather. |
| Real-time rain/snow radar + nowcast | Windy, Zoom.Earth | High | Large | RainViewer API is the pragmatic near-global shortcut (tiles + nowcast frames). Immediate "is it raining now" utility. |
| Altitude/pressure-level selector | Windy | Med | Med | Level dropdown re-sampling the multi-level dataset; only meaningful once model data exists. |
| Air-quality layers (PM2.5, dust, ozone, CO) | Windy | Med | Med | Same shader path as any scalar field; CAMS data. Complements existing quake/hurricane hazards, big during wildfire season. |
| Marine (waves, swell, currents, SST) | Windy | Med | Large | Separate WW3 ingest; audience-specific, lower priority. |

---

## Theme 5: Data & Layers — Earth Science, Hazards & Time Depth

| Gap | Who has it | Impact | Effort | How EarthOS could do it |
|---|---|---|---|---|
| Wildfire / active-fire heat-spot layer | Zoom.Earth | Med | **Small** | NASA FIRMS (VIIRS/MODIS) free global API drops into the existing point/GeoJSON pattern — same shape as earthquakes. Whole new hazard category for near-zero effort. |
| Global multi-basin hurricane coverage + forecast cones + history | Zoom.Earth | Med | Med | Add JTWC/NRL/IBTrACS to the existing NHC-only plugin; add cone geometry and historical tracks. |
| Scientific climate rasters (CO2, sea level, soil moisture, ozone) | NASA Eyes | High | Large | NASA GIBS/Worldview WMTS tiles; the heavy part is the colormap/legend/time-slice pipeline and dataset curation. Core to the "Earth twin" framing. |
| Historical / time-lapse basemap (satellite back to 1984) | Google, NASA Eyes | Med–High | Large | The sim clock is the right hook; the gap is a temporal imagery source. Sentinel-2 (2015+) / Landsat (1984+) or dated GIBS tiles, indexed by acquisition date, driven by the existing scrubber. Data pipeline is the heavy part. |

Note: EarthOS's clock can scrub backward, but **every live layer (TLE, ADS-B, USGS, NHC) is real-time only, so scrubbing into the past shows nothing.** Historical data backends are the recurring prerequisite here and in Themes 4 and 7. This is a structural weakness that undercuts EarthOS's best feature.

---

## Theme 6: Visual Realism (3D)

EarthOS drapes flat imagery on a geometrically smooth sphere. Google Earth and Cesium both render real relief and real cities. This is the biggest visual-credibility gap.

| Gap | Who has it | Impact | Effort | How EarthOS could do it |
|---|---|---|---|---|
| DEM 3D terrain relief (tilt to see mountains) | Google, Cesium | High | Med–Large | Stream quantized-mesh/terrain-RGB DEM (Mapbox terrain-rgb, AWS Terrain Tiles, or Cesium World Terrain) and displace the globe quadtree. Cheaper than photoreal tiles and a prerequisite for elevation profiles/contours. |
| Photorealistic 3D buildings / cities | Google, Cesium | High | Large | Google Photorealistic 3D Tiles (OGC 3D Tiles, streamable into R3F via 3d-tiles-renderer) — but per-session cost + ToS clash with free/OSS. OSS path: Cesium World Terrain + OSM Buildings for lower fidelity. |
| glTF 3D model loading (real ISS/aircraft/rocket meshes) | Cesium | Med | Med | three.js has GLTFLoader built in — mostly wiring + orientation on the globe. Upgrades satellite/aircraft sprites to recognizable craft. |
| Terrain clamping of vector data | Cesium | Med | Med | Depends on terrain first; drape GeoJSON/markers onto relief with correct z-order. |
| Extruded/volumetric vector primitives (airspace, sea-level rise) | Cesium | Med | Med | Straightforward three.js extruded geometry; unlocks things flat GeoJSON can't express. |
| Swappable basemaps + runtime picker + opacity/split-compare | Cesium | Med | **Small** | Basemap dropdown (satellite/streets/terrain-shaded/labels) + opacity + swipe compare — mostly UI over the existing quadtree streamer. Cheap discoverability win. |
| Shadows + cinematic post-processing (bloom, AO, selection silhouette) | Cesium | Low | Med | EarthOS already tracks the sun for the terminator → sun-position shadow mapping + R3F postprocessing selection outline. Diminishing returns vs terrain/mobile. |

---

## Theme 7: Analysis Tools — Space / SSA (KeepTrack & satellitemap.space own this)

EarthOS renders satellite positions but does zero derived analytics. This is where the two space-domain specialists have a real moat.

| Gap | Who has it | Impact | Effort | How EarthOS could do it |
|---|---|---|---|---|
| Observer/location pass prediction ("what's visible over me tonight") | satellitemap.space, KeepTrack | High | Med | Add a lat/lon observer + elevation/azimuth + sunlit-vs-shadow visibility math on top of the existing SGP4 workers. Turns a passive globe into a go-outside-and-look tool. Best-pass naked-eye visibility pairs with the existing terminator. |
| Constellation analytics dashboards (growth, launch history, decay, provider comparison, treemap) | satellitemap.space | High | Large | Historical time-series storage + charts. satellitemap.space's real moat — it's a statistics product, not just a globe. Heaviest space-domain lift. |
| Conjunction / close-approach detection | satellitemap.space, KeepTrack | Med–High | Large | Spatial-index/GPU proximity search across the propagated catalog per timestep. Headline capability for the space-safety audience; genuinely hard at 30k+ objects. |
| Ground-sensor modeling (radar/optical FOV cones, Az/El/Range) | KeepTrack | High | Large | Sensor database + spherical FOV intersection + AER math on the SGP4 output. Reframes "watch dots orbit" into "what can this station see and when." |
| Re-entry / orbital-decay board with countdowns | satellitemap.space, KeepTrack | Med | Med | Perigee/altitude threshold + decay-date estimate from CelesTrak/space-track decay data. Newsworthy, distinct layer. |
| Attribute-based coloring + constellation groups | KeepTrack | Med | Med | Recolor the satellite layer by country/type/velocity; "show only GPS/Galileo/OneWeb" filters. Real analytical richness for modest work. |
| Create/edit satellite (author a TLE, propagate live) | KeepTrack | Med | Med | Form/UX + inject a synthetic TLE into the existing worker feed. Turns viewer into light analysis tool. |
| ECI / inertial + planetarium reference frames | KeepTrack | Med | Med | Camera-transform work, no new data. Makes orbital planes legible in a way the rotating-Earth view can't; strong teaching tool. |
| Breakup/reentry simulation (debris cloud spread) | KeepTrack | Med | Large | Needs a fragmentation/velocity-perturbation model, not just rendering. Visually striking, shareable, education-friendly. |
| Analyst outputs (polar plots, best-pass tables, AER, DOPS, export) | KeepTrack, satellitemap.space | Med | Med | Derived-data panels + CSV export over the propagator. |
| Launch-schedule feed | KeepTrack | Med | Small | TheSpaceDevs / Gunter API — straightforward integration; adds a recurring reason to return. (Trajectory modeling is the larger half.) |
| Fuller catalog (space-track 30k+, debris/rocket bodies) | satellitemap.space | Med | Small | Ingest space-track full catalog + CelesTrak supplemental sets. |
| NEO / asteroid close-approach tracking | NASA Eyes | Low | Med | CNEOS free data; adjacent to existing orbit machinery but drifts from the Earth-surface twin. |
| Astrophotography tools (Sun/Moon transit, photobomb sim) | satellitemap.space | Low | Med | Reuses EarthOS's existing sun/moon ephemeris; opt-in tool. High virality-per-effort. |
| Ground-station / gateway layer | satellitemap.space, KeepTrack | Low | Small | Point layer over existing GeoJSON support. |

---

## Theme 8: Analysis Tools — Aviation (Flightradar24 owns this)

EarthOS renders aircraft as undifferentiated viewport-scoped dots with raw ADS-B fields on click.

| Gap | Who has it | Impact | Effort | How EarthOS could do it |
|---|---|---|---|---|
| Aircraft filtering (airline, type w/ wildcards, route, airport, country) | FR24 | High | Med | Client-side filter builder against the existing ADS-B feed once type/route metadata is joined. Core plane-spotting UX. |
| Rich per-flight panel (photo, registration, type, operator, origin/dest, ETA) | FR24 | High | Med | Photos free from planespotters.net API; registration/type from OpenSky metadata; route inference is the hard part. Biggest "depth" gap for casual users clicking a plane. |
| Airport entities (arrivals/departures boards, delays, runways, markers) | FR24 | High | Large | Needs a schedule/status source beyond ADS-B — a genuine new pipeline, not a layer. |
| Aviation weather (radar, winds-by-altitude, SIGMET/AIRMET, lightning) | FR24, Windy | Med | Med | NOAA/aviationweather.gov free; rendering/UI effort. Overlaps Theme 4. |
| Denser coverage via multi-feed fusion (adsb.fi/adsb.lol/OpenSky dedupe) | FR24 | Med | Med | Aggregate multiple free feeds without owning receivers; true MLAT/satellite parity impractical for OSS. |
| Historical flight playback | FR24 | Med | Large | Live ADS-B has no past-track memory. Requires server-side recording or a historical API — infra commitment against the no-backend design. |
| Aviation reference DB + tail/route/airline lookup | FR24 | Med | Med | Drives SEO + discovery; extends search beyond entity-on-map. |
| Flight alerts / notifications | FR24 | Low | Large | Needs auth + backend + push — conflicts with no-accounts design. Flag as a deliberate non-goal. |

---

## Theme 9: Sharing, Persistence & Extensibility

| Gap | Who has it | Impact | Effort | How EarthOS could do it |
|---|---|---|---|---|
| Persistent watchlist of tracked entities | satellitemap.space, KeepTrack | Med | **Small** | localStorage-backed favorites list (later syncable). Directly improves repeat-visit engagement; low effort. |
| Named scenario save/load + project export/import | Google, KeepTrack | Med | Med | Encode into the existing permalink system, or export/import a project JSON. Durability + sharing without standing up accounts. Middle path that fits the OSS/no-account ethos. |
| Cloud projects + cross-device sync + collaboration | Google, KeepTrack | Med | Large | Full parity needs auth + backend — a large architectural change against EarthOS's account-less stance. Not recommended near-term. |
| Cinematic keyframe/spline camera + guided narrated flythroughs | NASA Eyes, Google, Cesium | Med | Med | Eased keyframe camera controller underpins both authored tours and the existing clip-capture feature (directly improves something EarthOS already ships). |
| Public plugin API / SDK + gallery | Windy, Cesium | Med | Large | EarthOS has an internal plugin architecture but no external SDK. Exposing a stable layer/plugin API could turn contributors into a layer marketplace — a structural advantage over closed Windy. |
| CZML-style open time-dynamic data ingestion | Cesium | Low | Med | Support a CZML subset or time-tagged GeoJSON so users feed custom moving entities into EarthOS's sim clock — arguably its best and most underexploited feature. |
| Unit/display preferences (metric/imperial/nautical, timezone, animation speed) | Zoom.Earth | Low | Small | Settings panel over existing localStorage; only meaningful once weather layers exist to apply units to. |
| "Internet Race" latency explainer (Starlink mesh vs fiber) | satellitemap.space | Low | Med | Pick-two-cities shareable explainer; fits EarthOS's permalink/embed strengths. Low weight, high virality-per-effort. |

---

## Top 10 — Do These Next (impact ÷ effort, ranked)

Ordered to front-load cheap high-leverage wins and one strategic large bet.

1. **Measurement tools (distance + area).** High impact, small effort standalone. Universal expectation (Google, Zoom, Cesium), no new data — great-circle + spherical polygon math on click. The clearest near-term win.

2. **Wildfire / active-fire layer (NASA FIRMS).** Med impact, small effort. Drops into the existing earthquake-style point pattern; adds a whole hazard category almost for free.

3. **Guided first-run tour + curated featured-views gallery.** High impact, small–med effort. Just scripted permalink sequences + captions. Attacks EarthOS's worst non-technical weakness (discovery) and doubles as community-authorable content.

4. **KML/KMZ/Shapefile import.** Med impact, small effort. `togeojson` + `shpjs` into the existing GeoJSON renderer; instantly opens the GIS/planning audience.

5. **Persistent watchlist + swappable basemap picker.** Two small-effort, med-impact wins that both improve repeat engagement and discoverability over existing infra (localStorage + quadtree streamer).

6. **Live observed geostationary cloud imagery (GOES/Himawari via GIBS).** High impact, med effort. Replaces the fake cloud texture with real animating weather using the existing quadtree streamer + sim clock. High-value, reuses core plumbing.

7. **Observer pass prediction ("visible over me tonight").** High impact, med effort. Adds an observer point + visibility math to the existing SGP4 workers. Turns the globe into a personal go-look-up tool — the highest-leverage space feature that doesn't need a backend.

8. **Aircraft filtering + rich per-flight panel (photos, registration, route).** High impact, med effort combined. Closes the biggest depth gap vs FR24 using the existing ADS-B feed + free planespotters/OpenSky metadata.

9. **DEM 3D terrain relief.** High impact, med–large effort. Terrain-RGB/quantized-mesh displacement of the globe quadtree. Biggest visual-credibility fix and the prerequisite for elevation profiles, contours, and terrain clamping. Start here on the realism track before photoreal tiles.

10. **Mobile/responsive pass (PWA-first).** High impact, large effort — the strategic bet. Every competitor has it; it gates the majority of real-world usage for a "look up at the sky / check the weather" product. Won't ship in a sprint, but should start in parallel because everything above is worth more once it runs on a phone.

---

**Deliberately deferred (high effort, or conflict with EarthOS's design):** numerical weather-model + wind-particle pipeline (Windy parity — the biggest differentiator but heaviest lift; sequence after item 6 proves the data plumbing), constellation analytics dashboards, conjunction detection, ground-sensor modeling, photorealistic 3D city tiles (cost/ToS conflict with free-OSS), and anything requiring accounts (flight alerts, cloud projects, server-side historical playback) — flag these as non-goals unless the no-backend product direction changes.

**Recurring structural blocker worth naming:** EarthOS's simulation clock is its best feature, but all live layers are real-time-only, so scrubbing into the past shows nothing. A time-indexed historical data backend (dated imagery tiles, recorded tracks) is the shared prerequisite behind historical imagery, flight playback, and multi-decade climate layers. Worth a deliberate architecture decision rather than solving per-layer.
