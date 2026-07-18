# Rendering Architecture

## Coordinate frames (the one decision everything obeys)

- **Scene unit = 1 km.** Earth radius 6371, LEO ~6800, GEO 42164, Moon 384400. Far plane 500,000.
- **Logical frame: TEME/ECI** (what SGP4 outputs), float64 in JS.
- **Scene mapping:** `scene = (x_eci, z_eci, -y_eci)`: Y-up, right-handed, determinant +1.
- **The world frame is inertial.** Stars are static; the EARTH rotates. All Earth-fixed content lives under one group with `rotation.y = GMST`; children authored in swizzled-ECEF local coordinates (`geodeticToScene`) get ECEF-to-ECI conversion from a single group matrix, never per object.

Verified invariants (see `packages/gis/tests/frames.test.ts`): `S(Rz(g)·v) = Ry(g)·S(v)`, so the group rotation is exactly the frame conversion; longitude 0 lands on a default three.js sphere's equirect texture center with zero phi offset; handedness survives cross products.

### Precision

Float32 ULP at Earth-surface range is ~0.8 m. With the minimum camera altitude clamped to 30 km, worst-case jitter is centipixels, so v1 renders in plain world coordinates. Street-level zoom needs camera-relative rendering plus tiled surface patches with per-tile origins: a documented upgrade, not a v1 feature. The dynamic near plane (`~0.15 x altitude`, clamped) keeps 24-bit depth clean at every zoom.

## The globe

One custom `ShaderMaterial` (not PBR: a single sun does not need an IBL pipeline):

- day/night blend with a soft `smoothstep(-0.12, 0.12, n.s)` terminator band
- night side kept at a twilight floor (`uNightFloor`, ~0.3 of the day imagery) so continents stay legible in darkness, with the night-lights texture added as emissive on top
- ocean specular from a mask texture
- procedural fallback (graticule on ocean blue) when no textures are supplied, so everything renders offline

Shells around it, ordered by `renderOrder` with `depthWrite` off: cloud sphere (+25 km, clearing the imagery tile drape so it never z-fights, alpha-mapped, lit by the sun light), additive fresnel atmosphere (x1.025, blue on the lit limb, warm at the terminator, fading into night). Sun/moon positions come from compact ephemerides in `@earthos/gis` (sun ~0.01 deg, moon ~1 deg: both far below a pixel at globe scale); the moon renders at true position, 2.2x radius for visibility.

## The 100,000-object pipeline

Per-frame CPU propagation is off the table (100k x ~10 us of SGP4 = a full second). Instead:

1. **Workers own static catalog shards** (~5k objects each) and propagate on request with the satellite.js `sgp4` fast path.
2. Batches return as **transferable `Float32Array`s** of interleaved position+velocity in scene coordinates, roughly every 15 sim-seconds per shard (wall-clock floored so extreme time rates cannot flood workers).
3. The vertex shader **extrapolates every frame**:
   `p(t) = p0 + v0·dt - 0.5·mu·p0/|p0|^3·dt^2`
   The gravity term cancels the quadratic error of linear dead reckoning, keeping objects sub-pixel between refreshes. Main-thread per-frame cost: one uniform write.
4. One `THREE.Points` per layer = one draw call. Earth occlusion (behind-the-globe) culling runs in the vertex shader; frustum culling is free GPU clipping.
5. **Picking runs the same math on the CPU** (`pickExtrapolated`), so clicks hit exactly what pixels show, with Earth occlusion respected. Brute force over the catalog costs a few hundred microseconds on click.

The float32 time attribute rebases every 2 hours of sim time so precision never decays. Earth-fixed layers (earthquakes, GeoJSON) reuse the same pipeline with `mu = 0` and zero velocities, parented under the rotating group.

## React integration rules

- The render loop, worker buffers, and the sim clock live OUTSIDE React.
- Scene components bind refs and mutate in `useFrame`; zero `setState` in the frame path.
- UI state (selection, layer toggles, ~4 Hz camera snapshots) flows through zustand normally: re-renders there are fine.
- Layer renderers mount through `PluginLayersHost` inside error boundaries: a crashing plugin marks its layer errored instead of unmounting the globe.

## Deferred (documented upgrade paths)

Tiled terrain with per-tile origins, MapLibre 2D fallback, Bruneton precomputed scattering, HDR + selective bloom, icon/model LOD tiers above the sprite tier (the tier caps and hysteresis strategy are specified in [PERFORMANCE.md](PERFORMANCE.md)).
