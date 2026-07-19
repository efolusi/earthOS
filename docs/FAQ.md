# FAQ

**Why don't I see any satellites?**
The catalog comes from CelesTrak, fetched browser-direct (it serves permissive CORS). CelesTrak throttles repeat downloads per IP, and cloud/serverless hosts can't reach it at all, so the provider automatically falls back to the public TLE API and pages through the full constellation (a dense Starlink shell, not a sparse sample). Check the layer's status dot: red means both sources failed. Old data keeps rendering for up to 72 h once fetched. The group setting selects the constellation: `stations` is ~25 objects while `starlink` is ~10,000.

**Why is the night side dark where I expected city lights?**
The night side is deliberately kept dim-but-legible (a twilight floor) with Black Marble city lights on top, so continents stay visible in darkness. City lights and the sharpest terrain need the textures to load (`/textures/earth_lights_2048.png` and the day map); without them the globe falls back to a stylized procedural look.

**Can I run it offline?**
Yes. The globe, stars, day/night terminator, and the GeoJSON sample render with zero network. Data layers show their last cached catalog (IndexedDB) or an error state.

**How accurate are the orbits?**
SGP4 via satellite.js, the same model TLE/GP data is generated for: hundreds of meters to km-level, standard for visualization and pass prediction. Between worker refreshes the GPU extrapolates with a gravity-corrected quadratic; the residual is sub-pixel at any legal zoom.

**How do I add my own data?**
Quickest: the Custom GeoJSON layer with any FeatureCollection URL. To see it working, paste `https://earthos.efolusi.com/samples/kdmp-merah-putih-sample.geojson` into that layer's "GeoJSON URL" setting: 1,900 Koperasi Desa/Kelurahan Merah Putih candidate locations across Indonesia, plotted as village centroids (where a KDMP is mandated, not a verified per-cooperative registry). Real integration: `pnpm create earthos-plugin my-layer` and see [PLUGIN_GUIDE.md](PLUGIN_GUIDE.md).

**Does scrubbing time move the satellites correctly?**
Yes: the simulation clock drives SGP4 propagation, the Earth's rotation (GMST), the sun, the moon, and the terminator together. Scrub hours into the future and constellations, lighting, and ground tracks stay consistent.

**Why one Canvas instead of one per layer?**
WebGL contexts are expensive and R3F context identity breaks across boundaries. Plugins render into the host Canvas through `PluginLayersHost`; the single-instance peer rule exists for the same reason.

**Mobile?**
The UI is responsive and textures are modest (2k). The points pipeline is mobile-friendly (one draw call). Device-tier texture caps and icon/model LOD tiers are on the roadmap before we call mobile officially supported.

**Where is MapLibre?**
Reserved for the 2D fallback mode and tile-based layers (see ROADMAP). The `TileProvider` base and the `maplibre-gl` peer slot exist so tile plugins land without new architecture.

**License and data terms?**
Code is MIT. The Earth textures are derived from public NASA imagery but the shipped files carry their own terms (Solar System Scope, CC BY 4.0, for the HD set; three.js base set), credited in [apps/web/public/textures/CREDITS.md](../apps/web/public/textures/CREDITS.md). Each plugin's README states its data source's terms (CelesTrak usage guidelines, USGS public domain, and so on); respect them when you change refresh policies. The sample dataset under `apps/web/public/samples/` is the most restrictive asset here: its geometry comes from Badan Informasi Geospasial (BIG), which declares no open-data licence, so attribute BIG and confirm reuse terms with them before redistributing it beyond this demo. Full provenance in [apps/web/public/samples/CREDITS.md](../apps/web/public/samples/CREDITS.md).
