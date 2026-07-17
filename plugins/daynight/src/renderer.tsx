'use client';

import { useEffect, useMemo, useRef } from 'react';
import { createPortal, useFrame } from '@react-three/fiber';
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  LineBasicMaterial,
  LineLoop,
  Mesh,
  MeshBasicMaterial,
  SphereGeometry,
} from 'three';
import type { LayerRenderer, PluginContext } from '@earthos/core';
import { useEarthFixed } from '@earthos/globe';
import { geodeticToScene, subsolarPoint, sublunarPoint, terminatorRing } from '@earthos/gis';

const RING_STEPS = 180;
const LINE_ALT_KM = 25;
/** Re-generate when sim time moved this much (the terminator crawls ~0.25 deg/min). */
const REFRESH_SIM_MS = 30_000;

interface DayNightSettings {
  showTerminator?: boolean;
  showSubsolar?: boolean;
  showSublunar?: boolean;
  lineColor?: string;
}

function DayNightLayer({ ctx }: { ctx: PluginContext }) {
  const earthFixed = useEarthFixed();
  const lastGenMs = useRef(-Infinity);

  const line = useMemo(() => {
    const geometry = new BufferGeometry();
    geometry.setAttribute(
      'position',
      new BufferAttribute(new Float32Array((RING_STEPS + 1) * 3), 3),
    );
    geometry.setDrawRange(0, 0);
    const material = new LineBasicMaterial({ color: '#fbbf24', transparent: true, opacity: 0.8 });
    const loop = new LineLoop(geometry, material);
    loop.frustumCulled = false;
    return loop;
  }, []);

  const subsolarMarker = useMemo(
    () =>
      new Mesh(
        new SphereGeometry(60, 16, 12),
        new MeshBasicMaterial({ color: '#ffd66b', blending: AdditiveBlending, transparent: true }),
      ),
    [],
  );
  const sublunarMarker = useMemo(
    () =>
      new Mesh(
        new SphereGeometry(45, 16, 12),
        new MeshBasicMaterial({ color: '#cbd5e1', transparent: true, opacity: 0.9 }),
      ),
    [],
  );

  useEffect(
    () => () => {
      line.geometry.dispose();
      (line.material as LineBasicMaterial).dispose();
      subsolarMarker.geometry.dispose();
      (subsolarMarker.material as MeshBasicMaterial).dispose();
      sublunarMarker.geometry.dispose();
      (sublunarMarker.material as MeshBasicMaterial).dispose();
    },
    [line, subsolarMarker, sublunarMarker],
  );

  // Force refresh on time jumps.
  useEffect(() => ctx.time.onChange(() => (lastGenMs.current = -Infinity)), [ctx]);

  useFrame(() => {
    const now = ctx.time.now();
    if (Math.abs(now - lastGenMs.current) < REFRESH_SIM_MS) return;
    lastGenMs.current = now;

    const s = ctx.settings.get() as DayNightSettings;
    (line.material as LineBasicMaterial).color = new Color(s.lineColor ?? '#fbbf24');

    if (s.showTerminator !== false) {
      const ring = terminatorRing(now, RING_STEPS);
      const attr = line.geometry.getAttribute('position') as BufferAttribute;
      const arr = attr.array as Float32Array;
      const scratch: [number, number, number] = [0, 0, 0];
      for (let i = 0; i < ring.length; i++) {
        const [lon, lat] = ring[i]!;
        geodeticToScene(lat, lon, LINE_ALT_KM, scratch);
        arr[i * 3] = scratch[0];
        arr[i * 3 + 1] = scratch[1];
        arr[i * 3 + 2] = scratch[2];
      }
      attr.needsUpdate = true;
      line.geometry.setDrawRange(0, ring.length);
    } else {
      line.geometry.setDrawRange(0, 0);
    }

    const sub = subsolarPoint(now);
    const scratch: [number, number, number] = [0, 0, 0];
    geodeticToScene(sub.latDeg, sub.lonDeg, 40, scratch);
    subsolarMarker.position.set(scratch[0], scratch[1], scratch[2]);
    subsolarMarker.visible = s.showSubsolar !== false;

    if (s.showSublunar) {
      const lunar = sublunarPoint(now);
      geodeticToScene(lunar.latDeg, lunar.lonDeg, 40, scratch);
      sublunarMarker.position.set(scratch[0], scratch[1], scratch[2]);
      sublunarMarker.visible = true;
    } else {
      sublunarMarker.visible = false;
    }
  });

  if (!earthFixed) return null;
  return createPortal(
    <>
      <primitive object={line} />
      <primitive object={subsolarMarker} />
      <primitive object={sublunarMarker} />
    </>,
    earthFixed,
  );
}

const renderer: LayerRenderer = { Component: DayNightLayer };
export default renderer;
