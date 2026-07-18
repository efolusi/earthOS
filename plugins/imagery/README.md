# @earthos/plugin-imagery

Streamed high-resolution imagery for EarthOS: a web-mercator quadtree refines against screen-space error and drapes curved, sun-lit tile meshes over the globe, so sharpness scales with zoom the way slippy maps do instead of being capped by one global texture.

- Refinement runs at 4 Hz (never in the frame path), culls beyond the horizon and outside the view cone, and caps at 96 desired tiles.
- Coarse ancestors stay visible until their children finish streaming: zooming never shows holes.
- Tiles are lit with the same day/night response as the base globe, so they blend at the terminator.
- LRU texture cache (220 tiles, ~55 MB GPU) with full disposal on eviction.

## Sources

| Setting          | Source                        | Terms                                                                                              |
| ---------------- | ----------------------------- | -------------------------------------------------------------------------------------------------- |
| `esri` (default) | Esri World Imagery            | attribution required: "Esri, Maxar, Earthstar Geographics"; review Esri's terms for production use |
| `eox`            | EOX Sentinel-2 cloudless 2020 | CC BY-NC (attribution, non-commercial); contains modified Copernicus data                          |
| `custom`         | your `{z}/{x}/{y}` template   | your terms; point it at your own tile server for production                                        |

The layer panel shows the attribution; keep it visible in your product.

## Limits (honest ones)

`maxZoom` 12 gives a ~19 m texel: continents, cities, and coastlines are crisp, and street grids appear. True street-level (Google Maps zoom 18+) additionally needs the floating-origin camera and sub-30 km altitudes on the roadmap; raise `maxZoom` toward 15 at your own bandwidth cost.
