# @earthos/plugin-satellites

## 0.2.0

### Minor Changes

- 1ad1db6: Add a "Hide by name" setting so a constellation can be excluded from the catalog.

  The `active` group is roughly 80% Starlink, which buried everything else and made
  the group close to useless for looking at any other satellite. The new `exclude`
  setting takes comma-separated terms matched case-insensitively against
  `OBJECT_NAME`, so `starlink` shows the rest of the catalog and `starlink, oneweb`
  drops both megaconstellations.

  Filtering happens before the catalog is sharded into the SGP4 workers, so hidden
  objects cost no propagation rather than just no pixels, and it re-derives from the
  catalog already in memory, so changing the filter is instant and never refetches
  the group.
