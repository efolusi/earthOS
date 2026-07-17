# FAQ

**Why don't I see any satellites?**
The catalog comes from CelesTrak. Check the layer's status dot: red means the fetch failed (network blocks, or upstream rate limiting; the flagship app proxies through `/api/proxy/celestrak` to avoid most of this). Old data keeps rendering for up to 72 h once fetched. Also check the group setting: `stations` is ~25 objects while `starlink` is ~10,000.

**Why is the night side dark where I expected city lights?**
The night texture must load (`/textures/earth_lights_2048.png`). Without textures the globe falls back to a stylized procedural look with no lights.

**Can I run it offline?**
Yes. The globe, stars, day/night terminator, and the GeoJSON sample render with zero network. Data layers show their last cached catalog (IndexedDB) or an error state.

**How accurate are the orbits?**
SGP4 via satellite.js, the same model TLE/GP data is generated for: hundreds of meters to km-level, standard for visualization and pass prediction. Between worker refreshes the GPU extrapolates with a gravity-corrected quadratic; the residual is sub-pixel at any legal zoom.

**How do I add my own data?**
Quickest: the Custom GeoJSON layer with any FeatureCollection URL. Real integration: `pnpm create earthos-plugin my-layer` and see [PLUGIN_GUIDE.md](PLUGIN_GUIDE.md).

**Does scrubbing time move the satellites correctly?**
Yes: the simulation clock drives SGP4 propagation, the Earth's rotation (GMST), the sun, the moon, and the terminator together. Scrub hours into the future and constellations, lighting, and ground tracks stay consistent.

**Why one Canvas instead of one per layer?**
WebGL contexts are expensive and R3F context identity breaks across boundaries. Plugins render into the host Canvas through `PluginLayersHost`; the single-instance peer rule exists for the same reason.

**Mobile?**
The UI is responsive and textures are modest (2k). The points pipeline is mobile-friendly (one draw call). Device-tier texture caps and icon/model LOD tiers are on the roadmap before we call mobile officially supported.

**Where is MapLibre?**
Reserved for the 2D fallback mode and tile-based layers (see ROADMAP). The `TileProvider` base and the `maplibre-gl` peer slot exist so tile plugins land without new architecture.

**License and data terms?**
Code is MIT. NASA imagery is public domain. Each plugin's README states its data source's terms (CelesTrak usage guidelines, USGS public domain, and so on); respect them when you change refresh policies.
