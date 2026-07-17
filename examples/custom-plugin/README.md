# Example: a third-party EarthOS plugin

World capitals as a complete, searchable, clickable EarthOS layer. This is the reference for writing plugins OUTSIDE the EarthOS monorepo: the same file shape `create-earthos-plugin` scaffolds, filled in with a real (embedded) dataset.

What it demonstrates:

- `StaticProvider`: fetch once, cache forever
- The shared GPU points pipeline for surface markers (`mu: 0`, earth-fixed portal)
- Entity source registration: capitals appear in the command palette and inspector
- The contract test suite (`pnpm test`), which runs offline

Use it in any EarthOS app:

```tsx
import { Earth, Layer } from 'earthos';

<Earth>
  <Layer
    manifest={() => import('@earthos-examples/custom-plugin')}
    settings={{ color: '#f472b6' }}
  />
</Earth>;
```
