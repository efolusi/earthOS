import { defineConfig } from 'tsup';
import { packagePreset } from '@earthos/config/tsup-package';

export default defineConfig(
  packagePreset({
    external: [
      'react',
      'react-dom',
      'three',
      '@react-three/fiber',
      '@react-three/drei',
      'framer-motion',
      /^@earthos\//,
    ],
    banner: { js: '"use client";' },
    treeshake: false,
  }),
);
