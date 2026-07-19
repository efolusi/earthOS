# @earthos/plugin-daynight

The day/night terminator and subsolar/sublunar markers, computed entirely client-side from compact solar and lunar ephemerides in `@earthos/gis`. No network, no provider: this plugin is the minimal reference for the EarthOS plugin shape (manifest + renderer + settings).

The terminator follows the simulation clock: scrub the timeline and watch the night side sweep.

## Settings

| Key              | Default   |
| ---------------- | --------- |
| `showTerminator` | `true`    |
| `showSubsolar`   | `true`    |
| `showSublunar`   | `false`   |
| `lineColor`      | `#C08A5A` |
