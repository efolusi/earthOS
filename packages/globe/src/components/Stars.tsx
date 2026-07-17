'use client';

import { useMemo } from 'react';
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  PointsMaterial,
} from 'three';
import { STARFIELD_RADIUS } from '../constants';

function lcg(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

/**
 * Procedural starfield on the far sphere. The world frame is inertial (the
 * Earth rotates instead), so the stars are correctly static: no per-frame
 * work. Deterministic via a seeded generator.
 */
export function Stars({ count = 5000 }: { count?: number }) {
  const geometry = useMemo(() => {
    const rnd = lcg(20260718);
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      // Uniform on the sphere.
      const z = 2 * rnd() - 1;
      const phi = rnd() * Math.PI * 2;
      const r = Math.sqrt(Math.max(0, 1 - z * z));
      positions[i * 3] = STARFIELD_RADIUS * r * Math.cos(phi);
      positions[i * 3 + 1] = STARFIELD_RADIUS * z;
      positions[i * 3 + 2] = STARFIELD_RADIUS * r * Math.sin(phi);
      // Slight color temperature spread around white.
      const t = rnd();
      const brightness = 0.35 + 0.65 * rnd() ** 3;
      colors[i * 3] = brightness * (0.85 + 0.15 * t);
      colors[i * 3 + 1] = brightness * (0.85 + 0.15 * (1 - Math.abs(t - 0.5)));
      colors[i * 3 + 2] = brightness * (0.85 + 0.15 * (1 - t));
    }
    const geo = new BufferGeometry();
    geo.setAttribute('position', new BufferAttribute(positions, 3));
    geo.setAttribute('color', new BufferAttribute(colors, 3));
    return geo;
  }, [count]);

  const material = useMemo(
    () =>
      new PointsMaterial({
        size: 1.6,
        sizeAttenuation: false,
        vertexColors: true,
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
      }),
    [],
  );

  return <points geometry={geometry} material={material} frustumCulled={false} />;
}
