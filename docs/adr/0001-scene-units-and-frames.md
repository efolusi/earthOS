# ADR 0001: Scene units and coordinate frames

**Status:** accepted

## Decision

1 scene unit = 1 km. The world frame is inertial (TEME/ECI as SGP4 emits, swizzled `(x, z, -y)` to Y-up). Earth-fixed content lives under a single group rotated by GMST.

## Context

Satellites dominate the object count and SGP4 outputs TEME. Converting 100k satellites to an Earth-fixed frame per refresh costs work and precision; rotating ONE group by GMST converts every Earth-fixed object with one matrix. The swizzle was chosen so the proof `S(Rz(g)v) = Ry(g)S(v)` holds, which makes the group rotation exactly the ECEF-to-ECI conversion, and so a default three.js sphere's equirect UV mapping lands longitude 0 correctly with no texture offset.

## Consequences

Stars and the sun are static per frame (world = inertial): free. Ground content authors call `geodeticToScene` and portal into the earth-fixed group. Rays must be transformed into the group's local frame for picking ground layers (`rayToLocal`). Kilometer units keep every orbital number legible (LEO 6800, GEO 42164) and float32-safe at all legal zooms.
