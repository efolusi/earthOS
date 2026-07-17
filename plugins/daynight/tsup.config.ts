import { defineConfig } from 'tsup';
import { pluginPreset } from '@earthos/config/tsup-plugin';

export default defineConfig(
  pluginPreset({
    // No provider.ts: this plugin is fully computed, no network.
    entry: { provider: false },
    external: [
      'react',
      'three',
      '@react-three/fiber',
      '@earthos/core',
      '@earthos/gis',
      '@earthos/globe',
    ],
    banner: { js: '"use client";' },
    treeshake: false,
  }),
);
