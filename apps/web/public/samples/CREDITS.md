# Sample data credits

## kdmp-merah-putih-sample.geojson

A geographically stratified national **sample** (~50 villages per province,
1,900 points) of candidate/mandated Koperasi Desa/Kelurahan Merah Putih (KDMP)
locations.

KDMP is an Indonesian presidential program establishing one cooperative per
desa/kelurahan. Each point here is a **village centroid** representing where a
KDMP is mandated, **not** a verified per-cooperative office location or an
official cooperative registry.

Sampling is an equal ~50 villages per province (stride-sampled by
`kode_wilayah`), so the point set is geographically representative but **not**
density-proportional: every province gets the same number of points regardless
of how many desa/kelurahan it actually has. Do not read it as a national
density map.

**Sources**

- Geometry: **Badan Informasi Geospasial (BIG)** — "Batas Wilayah
  Kelurahan/Desa" 10K (RBI), https://geoservices.big.go.id — village boundary
  centroids, 2022-2023 vintage. BIG declares no open-data licence on this
  service and notes it is not an official reference pending definitive village
  boundaries. Attribute BIG and confirm reuse terms with BIG before
  redistributing beyond this demo sample.
- Administrative codes (`kode_wilayah`): Kementerian Dalam Negeri
  (Kepmendagri 300.2.2-2138/2025).
- Program context / totals: Kementerian Koperasi dashboard
  (simkopdes.go.id), as of 19/07/2026: 83,381 KDMP with legal entity status
  across 83,765 desa/kelurahan in 38 provinces.

This is a demo sample for the Custom GeoJSON 3D-location layer, not the full
83,765-village program footprint, and not an official government dataset.
