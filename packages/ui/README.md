# @earthos/ui

The EarthOS control surfaces: layer panel with schema-driven settings forms, timeline, inspector, command palette, and status bar. Styled with the Meridian design system (Efolusi) through CSS custom properties, laid out with Tailwind utility classes.

## Styling requirements

Components reference two things the consuming app provides:

1. **Tailwind content scanning.** The classes live in this package's `src` (shipped in the tarball). In your Tailwind v4 CSS entry:

```css
@import 'tailwindcss';
@source '../node_modules/@earthos/ui/src';
```

2. **Meridian tokens.** Components read semantic custom properties (`--surface-card`, `--text-primary`, `--border-default`, `--accent-subtle`, `--radius-lg`, `--font-mono`, and friends). Import the Meridian token sheet (see the flagship app's `app/meridian.css` for the vendored copy) or map the variables to your own system. Unset variables fall back to browser defaults, which will look broken; the tokens are not optional.

The flagship app (`apps/web`) is the reference wiring. The 3D packages (`@earthos/globe`, plugins) have no styling requirements at all.

## Components

| Export                               | Purpose                                                   |
| ------------------------------------ | --------------------------------------------------------- |
| `LayerPanel`                         | plugin catalog: toggles, status dots, expandable settings |
| `SettingsForm`                       | auto-rendered from any plugin's `defineSettings` schema   |
| `Timeline`                           | play/pause, rate stepping, hour jumps, live re-sync       |
| `Inspector`                          | selected-entity details with fly-to and follow            |
| `CommandPalette`                     | Cmd/Ctrl+K search across all layer entity sources         |
| `StatusBar`                          | camera readout, FPS meter, attribution                    |
| `GlassPanel`, `IconButton`, `Toggle` | the underlying Meridian surfaces                          |

All components require an `EarthEngineProvider` (or `<Earth/>`) above them.
