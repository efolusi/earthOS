'use client';

import { useEffect, useMemo } from 'react';
import { createPortal } from '@react-three/fiber';
import {
  BufferAttribute,
  BufferGeometry,
  Line,
  LineBasicMaterial,
  Points,
  PointsMaterial,
} from 'three';
import { useEarthFixed } from '@earthos/globe';
import { geodeticToScene } from '@earthos/gis';
import type { Observer } from './MyLocationPanel';

const MARK = '#67E8C4'; // mint, distinct from every layer hue
const BEAM_TOP_KM = 500;

/** "You are here": a bright dot on the surface with a vertical beam. */
export function MyLocationLayer({ observer }: { observer: Observer | null }) {
  const earthFixed = useEarthFixed();

  const dot = useMemo(() => {
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(new Float32Array(3), 3));
    const p = new Points(g, new PointsMaterial({ color: MARK, size: 12, sizeAttenuation: false }));
    p.frustumCulled = false;
    p.renderOrder = 32;
    return p;
  }, []);

  const beam = useMemo(() => {
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(new Float32Array(6), 3));
    const l = new Line(g, new LineBasicMaterial({ color: MARK, transparent: true, opacity: 0.7 }));
    l.frustumCulled = false;
    l.renderOrder = 32;
    return l;
  }, []);

  useEffect(
    () => () => {
      dot.geometry.dispose();
      (dot.material as PointsMaterial).dispose();
      beam.geometry.dispose();
      (beam.material as LineBasicMaterial).dispose();
    },
    [dot, beam],
  );

  useEffect(() => {
    if (!observer) return;
    const base: [number, number, number] = [0, 0, 0];
    const top: [number, number, number] = [0, 0, 0];
    geodeticToScene(observer.lat, observer.lon, 6, base);
    geodeticToScene(observer.lat, observer.lon, BEAM_TOP_KM, top);
    const d = dot.geometry.getAttribute('position') as BufferAttribute;
    (d.array as Float32Array).set(base);
    d.needsUpdate = true;
    dot.geometry.computeBoundingSphere();
    const b = beam.geometry.getAttribute('position') as BufferAttribute;
    (b.array as Float32Array).set([...base, ...top]);
    b.needsUpdate = true;
    beam.geometry.computeBoundingSphere();
  }, [observer, dot, beam]);

  if (!earthFixed || !observer) return null;
  return createPortal(
    <>
      <primitive object={beam} />
      <primitive object={dot} />
    </>,
    earthFixed,
  );
}
