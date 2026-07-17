/**
 * File templates for a polling-provider plugin. `__NAME__` is replaced with
 * the kebab-case plugin id, `__PASCAL__` with its PascalCase form.
 */
export function templates(name, pascal) {
  const sub = (s) => s.replaceAll('__NAME__', name).replaceAll('__PASCAL__', pascal);
  const files = {
    'package.json': `{
  "name": "earthos-plugin-__NAME__",
  "version": "0.1.0",
  "description": "EarthOS layer: __NAME__",
  "license": "MIT",
  "type": "module",
  "sideEffects": false,
  "exports": {
    ".": { "types": "./dist/index.d.ts", "import": "./dist/index.js" },
    "./renderer": { "types": "./dist/renderer.d.ts", "import": "./dist/renderer.js" },
    "./provider": { "types": "./dist/provider.d.ts", "import": "./dist/provider.js" }
  },
  "files": ["dist"],
  "scripts": {
    "build": "tsup",
    "dev": "tsup --watch",
    "lint": "eslint src tests",
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
  },
  "dependencies": {
    "@earthos/core": "^0.1.0",
    "@earthos/gis": "^0.1.0",
    "@earthos/providers": "^0.1.0"
  },
  "peerDependencies": {
    "@earthos/globe": "^0.1.0",
    "@react-three/fiber": "^9.0.0",
    "react": "^19.0.0",
    "three": ">=0.170.0"
  },
  "devDependencies": {
    "@earthos/config": "^0.1.0",
    "@earthos/globe": "^0.1.0",
    "@earthos/testing": "^0.1.0",
    "@react-three/fiber": "^9.6.0",
    "@types/react": "^19.0.0",
    "@types/three": "^0.185.0",
    "eslint": "^9.17.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "three": "^0.185.0",
    "tsup": "^8.3.5",
    "typescript": "^5.7.2",
    "vitest": "^3.0.0"
  },
  "keywords": ["earthos-plugin"]
}
`,
    'tsconfig.json': `{
  "extends": "@earthos/config/tsconfig/plugin.json",
  "include": ["src", "tests"]
}
`,
    'tsup.config.ts': `import { defineConfig } from 'tsup';
import { pluginPreset } from '@earthos/config/tsup-plugin';

export default defineConfig(
  pluginPreset({
    external: [
      'react',
      'three',
      '@react-three/fiber',
      '@earthos/core',
      '@earthos/gis',
      '@earthos/globe',
      '@earthos/providers',
    ],
    banner: { js: '"use client";' },
    treeshake: false,
  }),
);
`,
    'vitest.config.ts': `import { defineConfig } from 'vitest/config';
import { vitestPreset } from '@earthos/config/vitest';

export default defineConfig(vitestPreset());
`,
    'eslint.config.js': `import earthos from '@earthos/config/eslint';

export default earthos;
`,
    'src/settings.ts': `import { defineSettings, f } from '@earthos/core';

export const settings = defineSettings({
  version: 1,
  fields: {
    color: f.color({ label: 'Color', default: '#34d399' }),
    refreshSeconds: f.number({ label: 'Refresh', min: 10, max: 3600, default: 60, unit: 's' }),
  },
});

export default settings;
`,
    'src/types.ts': `export interface __PASCAL__Item {
  id: string;
  name: string;
  lat: number;
  lon: number;
}
`,
    'src/provider.ts': `import type { PluginContext, ProviderInstance } from '@earthos/core';
import { DataProvider, type FetchIO } from '@earthos/providers';
import type { __PASCAL__Item } from './types';

export class __PASCAL__Provider extends DataProvider<__PASCAL__Item[]> {
  readonly id = '__NAME__-source';

  constructor() {
    super();
    this.policyOverrides = {
      refresh: { intervalMs: 60_000, jitterMs: 5_000, pauseWhenHidden: true },
      cache: { staleAfterMs: 5 * 60_000, maxAgeMs: 24 * 3_600_000 },
      retry: { maxAttempts: 3, baseDelayMs: 3_000 },
    };
  }

  async fetch(_io: FetchIO): Promise<__PASCAL__Item[]> {
    // Replace with your data source. io.fetch throws typed errors on bad
    // status and is rate-limited per your policy.
    return [
      { id: '1', name: 'Null Island', lat: 0, lon: 0 },
    ];
  }
}

const createProvider = (_ctx: PluginContext): ProviderInstance<unknown> =>
  new __PASCAL__Provider() as ProviderInstance<unknown>;

export default createProvider;
`,
    'src/renderer.tsx': `'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal, useFrame, useThree } from '@react-three/fiber';
import type { LayerRenderer, PluginContext } from '@earthos/core';
import { ExtrapolatedPointsLayer, useEarthFixed } from '@earthos/globe';
import { geodeticToScene } from '@earthos/gis';
import type { __PASCAL__Item } from './types';

function __PASCAL__Layer({ ctx }: { ctx: PluginContext }) {
  const earthFixed = useEarthFixed();
  const gl = useThree((s) => s.gl);
  const [items, setItems] = useState<__PASCAL__Item[]>([]);

  const layer = useMemo(
    () => new ExtrapolatedPointsLayer({ capacity: 10_000, mu: 0, palette: ['#34d399'] }),
    [],
  );
  useEffect(() => () => layer.dispose(), [layer]);

  useEffect(() => {
    const handle = ctx.providers.handle<__PASCAL__Item[]>('__NAME__-source');
    if (!handle) return;
    const apply = (data: __PASCAL__Item[] | null) => {
      if (data) setItems(data);
    };
    apply(handle.get().data);
    return handle.subscribe((snap) => apply(snap.data));
  }, [ctx]);

  useEffect(() => {
    const posVel = new Float32Array(items.length * 6);
    const scratch: [number, number, number] = [0, 0, 0];
    items.forEach((item, i) => {
      geodeticToScene(item.lat, item.lon, 8, scratch);
      posVel.set(scratch, i * 6);
    });
    layer.writeBatch({ posVel, count: items.length, t0Ms: ctx.time.now(), offset: 0 });
    layer.setCount(items.length);
    layer.fillMeta(0, items.length, 0, 6);
  }, [ctx, layer, items]);

  useFrame(() => {
    layer.updateTime(ctx.time.now());
    layer.setPixelRatio(gl.getPixelRatio());
  });

  if (!earthFixed) return null;
  return createPortal(<primitive object={layer.points} />, earthFixed);
}

const renderer: LayerRenderer = { Component: __PASCAL__Layer };
export default renderer;
`,
    'src/plugin.ts': `import { definePlugin } from '@earthos/core';
import settings from './settings';

export default definePlugin({
  id: '__NAME__',
  apiVersion: 1,
  meta: {
    name: '__PASCAL__',
    category: 'custom',
    description: 'TODO: describe this layer',
  },
  settings,
  provider: () => import('./provider'),
  renderer: () => import('./renderer'),
});
`,
    'src/index.ts': `export { default } from './plugin';
export { settings } from './settings';
export type * from './types';
`,
    'tests/contract.test.ts': `import { runPluginContractTests } from '@earthos/testing';

runPluginContractTests(() => import('../src/plugin'));
`,
    'README.md': `# earthos-plugin-__NAME__

An EarthOS data layer. Develop against any EarthOS app:

\`\`\`tsx
import { Earth, Layer } from 'earthos';

<Earth>
  <Layer manifest={() => import('earthos-plugin-__NAME__')} />
</Earth>
\`\`\`

## Checklist before publishing

- [ ] Real data source in \`src/provider.ts\` (policy: refresh cadence, cache windows, rate limit)
- [ ] Rendering in \`src/renderer.tsx\` (points pipeline for many entities; lines/meshes for few)
- [ ] Settings schema in \`src/settings.ts\`
- [ ] Attribution + data source terms here in the README
- [ ] \`pnpm test\` green (the contract suite runs offline)
`,
  };
  return Object.fromEntries(Object.entries(files).map(([k, v]) => [k, sub(v)]));
}
