'use client';

import { useEffect, useMemo } from 'react';
import { createPortal, useThree } from '@react-three/fiber';
import {
  BufferAttribute,
  BufferGeometry,
  Line,
  LineBasicMaterial,
  Points,
  PointsMaterial,
} from 'three';
import { useEarth } from '@earthos/core/react';
import { useEarthFixed } from '@earthos/globe';
import {
  EARTH_RADIUS_KM,
  ecefToGeodetic,
  eciToEcefAt,
  geodeticToScene,
  sampleGreatCircle,
  sceneToEci,
} from '@earthos/gis';

const ARC_ALT_KM = 8; // sit above the imagery tile drape so the path is never buried
const SEG_PER_LEG = 48;
const MAX_VERTS = 512;

export interface MeasurePoint {
  lat: number;
  lon: number;
}

/**
 * Renders the measurement path (curved great-circle legs + vertex markers) in
 * the rotating earth-fixed frame, and turns globe clicks into lat/lon points
 * while measure mode is active. Camera drags (orbit) are ignored.
 */
export function MeasureLayer({
  active,
  points,
  onAddPoint,
}: {
  active: boolean;
  points: MeasurePoint[];
  onAddPoint: (lat: number, lon: number) => void;
}) {
  const engine = useEarth();
  const earthFixed = useEarthFixed();
  const gl = useThree((s) => s.gl);
  const camera = useThree((s) => s.camera);

  // Curved path line + vertex dots, mutated in place per points change.
  const line = useMemo(() => {
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(new Float32Array(MAX_VERTS * 3), 3));
    geometry.setDrawRange(0, 0);
    const l = new Line(
      geometry,
      new LineBasicMaterial({ color: '#F4E9D2', transparent: true, opacity: 0.9 }),
    );
    l.frustumCulled = false;
    l.renderOrder = 30;
    return l;
  }, []);

  const dots = useMemo(() => {
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(new Float32Array(256 * 3), 3));
    geometry.setDrawRange(0, 0);
    const p = new Points(
      geometry,
      new PointsMaterial({ color: '#FFFFFF', size: 9, sizeAttenuation: false }),
    );
    p.frustumCulled = false;
    p.renderOrder = 31;
    return p;
  }, []);

  useEffect(
    () => () => {
      line.geometry.dispose();
      (line.material as LineBasicMaterial).dispose();
      dots.geometry.dispose();
      (dots.material as PointsMaterial).dispose();
    },
    [line, dots],
  );

  // Rebuild geometry when the point list changes.
  useEffect(() => {
    const lineAttr = line.geometry.getAttribute('position') as BufferAttribute;
    const lineArr = lineAttr.array as Float32Array;
    const scratch: [number, number, number] = [0, 0, 0];
    let v = 0;
    for (let i = 0; i < points.length - 1 && v < MAX_VERTS - SEG_PER_LEG; i++) {
      const arc = sampleGreatCircle(
        points[i]!.lat,
        points[i]!.lon,
        points[i + 1]!.lat,
        points[i + 1]!.lon,
        SEG_PER_LEG,
      );
      for (const [lat, lon] of arc) {
        geodeticToScene(lat, lon, ARC_ALT_KM, scratch);
        lineArr[v * 3] = scratch[0];
        lineArr[v * 3 + 1] = scratch[1];
        lineArr[v * 3 + 2] = scratch[2];
        v++;
      }
    }
    lineAttr.needsUpdate = true;
    line.geometry.setDrawRange(0, v);
    line.geometry.computeBoundingSphere();

    const dotAttr = dots.geometry.getAttribute('position') as BufferAttribute;
    const dotArr = dotAttr.array as Float32Array;
    points.slice(0, 256).forEach((p, i) => {
      geodeticToScene(p.lat, p.lon, ARC_ALT_KM, scratch);
      dotArr[i * 3] = scratch[0];
      dotArr[i * 3 + 1] = scratch[1];
      dotArr[i * 3 + 2] = scratch[2];
    });
    dotAttr.needsUpdate = true;
    dots.geometry.setDrawRange(0, Math.min(points.length, 256));
    dots.geometry.computeBoundingSphere();
  }, [points, line, dots]);

  // Globe clicks → lat/lon (only while measuring; ignore drags).
  useEffect(() => {
    if (!active) return;
    const dom = gl.domElement;
    dom.style.cursor = 'crosshair';
    let downX = 0;
    let downY = 0;
    const onDown = (e: PointerEvent) => {
      downX = e.clientX;
      downY = e.clientY;
    };
    const onClick = (e: MouseEvent) => {
      if (Math.hypot(e.clientX - downX, e.clientY - downY) > 5) return; // drag, not click
      const rect = dom.getBoundingClientRect();
      const ndcX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const ndcY = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      // Ray from the camera through the click; intersect the globe sphere.
      const origin = camera.position;
      const world = ndcToWorldDir(ndcX, ndcY, camera as never);
      const hit = raySphere([origin.x, origin.y, origin.z], world, EARTH_RADIUS_KM);
      if (!hit) return;
      const eci = sceneToEci(hit[0], hit[1], hit[2]);
      const ecef = eciToEcefAt(eci[0], eci[1], eci[2], engine.time.now());
      const geo = ecefToGeodetic(ecef[0], ecef[1], ecef[2]);
      onAddPoint(geo.latDeg, geo.lonDeg);
    };
    dom.addEventListener('pointerdown', onDown);
    dom.addEventListener('click', onClick);
    return () => {
      dom.removeEventListener('pointerdown', onDown);
      dom.removeEventListener('click', onClick);
      dom.style.cursor = '';
    };
  }, [active, gl, camera, engine, onAddPoint]);

  if (!earthFixed) return null;
  return createPortal(
    <>
      <primitive object={line} />
      <primitive object={dots} />
    </>,
    earthFixed,
  );
}

/** World-space ray direction through an NDC point for a perspective camera. */
function ndcToWorldDir(
  ndcX: number,
  ndcY: number,
  camera: {
    projectionMatrixInverse: { elements: number[] };
    matrixWorld: { elements: number[] };
    position: { x: number; y: number; z: number };
  },
): [number, number, number] {
  // Unproject a point on the near-ish plane, subtract the camera position.
  const p = applyMat4([ndcX, ndcY, 0.5], camera.projectionMatrixInverse.elements);
  const w = applyMat4(p, camera.matrixWorld.elements);
  const d: [number, number, number] = [
    w[0] - camera.position.x,
    w[1] - camera.position.y,
    w[2] - camera.position.z,
  ];
  const len = Math.hypot(d[0], d[1], d[2]) || 1;
  return [d[0] / len, d[1] / len, d[2] / len];
}

/** Apply a 4x4 (column-major) matrix to a point, with perspective divide. */
function applyMat4(v: [number, number, number], e: number[]): [number, number, number] {
  const [x, y, z] = v;
  const w = e[3]! * x + e[7]! * y + e[11]! * z + e[15]! || 1;
  return [
    (e[0]! * x + e[4]! * y + e[8]! * z + e[12]!) / w,
    (e[1]! * x + e[5]! * y + e[9]! * z + e[13]!) / w,
    (e[2]! * x + e[6]! * y + e[10]! * z + e[14]!) / w,
  ];
}

/** Smallest-positive intersection of origin+t·dir with the sphere |p|=R. */
function raySphere(
  o: [number, number, number],
  d: [number, number, number],
  R: number,
): [number, number, number] | null {
  const b = 2 * (o[0] * d[0] + o[1] * d[1] + o[2] * d[2]);
  const c = o[0] ** 2 + o[1] ** 2 + o[2] ** 2 - R * R;
  const disc = b * b - 4 * c;
  if (disc < 0) return null;
  const t = (-b - Math.sqrt(disc)) / 2;
  if (t < 0) return null;
  return [o[0] + t * d[0], o[1] + t * d[1], o[2] + t * d[2]];
}
