import { defineConfig } from 'tsup';
import { packagePreset } from '@earthos/config/tsup-package';

export default defineConfig(
  packagePreset({
    entry: ['src/index.ts'],
    external: ['react', 'three', '@react-three/fiber', '@react-three/drei'],
    // The whole package is client-side 3D; keep the RSC boundary marker.
    // (rollup treeshake would strip the banner again, so keep it off here)
    banner: { js: '"use client";' },
    treeshake: false,
  }),
);
