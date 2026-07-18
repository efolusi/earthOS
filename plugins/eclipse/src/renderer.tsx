'use client';

import { useEffect, useMemo, useRef } from 'react';
import { createPortal, useFrame } from '@react-three/fiber';
import {
  BufferAttribute,
  BufferGeometry,
  DoubleSide,
  LineBasicMaterial,
  LineLoop,
  Mesh,
  MeshBasicMaterial,
} from 'three';
import type { LayerRenderer, PluginContext } from '@earthos/core';
import { useEarthFixed } from '@earthos/globe';
import { EARTH_RADIUS_KM, RAD2DEG, DEG2RAD, geodeticToScene, normalizeLonDeg } from '@earthos/gis';
import { shadowAt } from './shadow';

const RING_STEPS = 90;
const ALT_KM = 30;
const REFRESH_SIM_MS = 5_000;

/** Small circle of angular radius `thetaRad` around a geodetic center. */
function sphereCircle(
  latDeg: number,
  lonDeg: number,
  thetaRad: number,
  out: Float32Array,
  steps: number,
  altKm: number,
): void {
  const lat0 = latDeg * DEG2RAD;
  const lon0 = lonDeg * DEG2RAD;
  const scratch: [number, number, number] = [0, 0, 0];
  for (let i = 0; i < steps; i++) {
    const bearing = (i / steps) * 2 * Math.PI;
    const lat = Math.asin(
      Math.sin(lat0) * Math.cos(thetaRad) + Math.cos(lat0) * Math.sin(thetaRad) * Math.cos(bearing),
    );
    const lon =
      lon0 +
      Math.atan2(
        Math.sin(bearing) * Math.sin(thetaRad) * Math.cos(lat0),
        Math.cos(thetaRad) - Math.sin(lat0) * Math.sin(lat),
      );
    geodeticToScene(lat * RAD2DEG, normalizeLonDeg(lon * RAD2DEG), altKm, scratch);
    out[i * 3] = scratch[0];
    out[i * 3 + 1] = scratch[1];
    out[i * 3 + 2] = scratch[2];
  }
}

function EclipseLayer({ ctx }: { ctx: PluginContext }) {
  const earthFixed = useEarthFixed();
  const lastGenMs = useRef(-Infinity);

  // Penumbra outline.
  const penumbraRing = useMemo(() => {
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(new Float32Array(RING_STEPS * 3), 3));
    geometry.setDrawRange(0, 0);
    const loop = new LineLoop(
      geometry,
      new LineBasicMaterial({ color: '#948a74', transparent: true, opacity: 0.55 }),
    );
    loop.frustumCulled = false;
    return loop;
  }, []);

  // Umbra: filled dark fan (center + rim).
  const umbraDisc = useMemo(() => {
    const geometry = new BufferGeometry();
    geometry.setAttribute(
      'position',
      new BufferAttribute(new Float32Array((RING_STEPS + 1) * 3), 3),
    );
    const indices: number[] = [];
    for (let i = 0; i < RING_STEPS; i++) {
      indices.push(0, 1 + i, 1 + ((i + 1) % RING_STEPS));
    }
    geometry.setIndex(indices);
    const mesh = new Mesh(
      geometry,
      new MeshBasicMaterial({
        color: '#000000',
        transparent: true,
        opacity: 0.75,
        side: DoubleSide,
        depthWrite: false,
      }),
    );
    mesh.renderOrder = 20;
    mesh.frustumCulled = false;
    return mesh;
  }, []);

  useEffect(
    () => () => {
      penumbraRing.geometry.dispose();
      (penumbraRing.material as LineBasicMaterial).dispose();
      umbraDisc.geometry.dispose();
      (umbraDisc.material as MeshBasicMaterial).dispose();
    },
    [penumbraRing, umbraDisc],
  );

  useEffect(() => ctx.time.onChange(() => (lastGenMs.current = -Infinity)), [ctx]);

  useFrame(() => {
    const now = ctx.time.now();
    if (Math.abs(now - lastGenMs.current) < REFRESH_SIM_MS) return;
    lastGenMs.current = now;

    const shadow = shadowAt(now);
    if (!shadow.hit) {
      penumbraRing.geometry.setDrawRange(0, 0);
      umbraDisc.visible = false;
      return;
    }

    const penumbraTheta = shadow.penumbraKm / EARTH_RADIUS_KM;
    const attr = penumbraRing.geometry.getAttribute('position') as BufferAttribute;
    sphereCircle(shadow.latDeg, shadow.lonDeg, penumbraTheta, attr.array as Float32Array, RING_STEPS, ALT_KM);
    attr.needsUpdate = true;
    penumbraRing.geometry.setDrawRange(0, RING_STEPS);

    if (shadow.umbraKm > 0) {
      const umbraTheta = Math.max(shadow.umbraKm, 15) / EARTH_RADIUS_KM; // floor for visibility
      const uAttr = umbraDisc.geometry.getAttribute('position') as BufferAttribute;
      const arr = uAttr.array as Float32Array;
      const center: [number, number, number] = [0, 0, 0];
      geodeticToScene(shadow.latDeg, shadow.lonDeg, ALT_KM, center);
      arr[0] = center[0];
      arr[1] = center[1];
      arr[2] = center[2];
      sphereCircle(shadow.latDeg, shadow.lonDeg, umbraTheta, arr.subarray(3) as Float32Array, RING_STEPS, ALT_KM);
      uAttr.needsUpdate = true;
      umbraDisc.geometry.computeBoundingSphere();
      umbraDisc.visible = true;
    } else {
      umbraDisc.visible = false;
    }
  });

  if (!earthFixed) return null;
  return createPortal(
    <>
      <primitive object={penumbraRing} />
      <primitive object={umbraDisc} />
    </>,
    earthFixed,
  );
}

const renderer: LayerRenderer = { Component: EclipseLayer };
export default renderer;
