'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { MathUtils, Vector3, type PerspectiveCamera } from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { useEarth } from '@earthos/core/react';
import type { CameraSnapshot, FlyToTarget } from '@earthos/core';
import { ecefToGeodetic, eciToEcefAt, geodeticToScene, gmstRad, sceneToEci } from '@earthos/gis';
import { GLOBE_RADIUS, MAX_CAMERA_DISTANCE, MIN_CAMERA_ALTITUDE_KM } from '../constants';
import { trackersOf, type EntityTracker } from '../trackers';

const STORE_SYNC_INTERVAL_S = 0.25;

interface Flight {
  from: Vector3;
  to: Vector3;
  startMs: number;
  durationMs: number;
}

/** World position above a geodetic point at `altKm`, at sim time `now`. */
function worldAbove(latDeg: number, lonDeg: number, altKm: number, nowMs: number): Vector3 {
  const local = geodeticToScene(latDeg, lonDeg, altKm);
  const g = gmstRad(nowMs);
  const cos = Math.cos(g);
  const sin = Math.sin(g);
  return new Vector3(cos * local[0] + sin * local[2], local[1], -sin * local[0] + cos * local[2]);
}

/**
 * Orbit camera around the globe with fly-to animation, entity follow, a
 * min-altitude clamp, dynamic near plane, and throttled store snapshots
 * (~4 Hz) so UI readouts and viewport-scoped providers can react without
 * per-frame React work.
 */
export function GlobeCamera() {
  const engine = useEarth();
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const controlsRef = useRef<OrbitControlsImpl | null>(null);
  const flight = useRef<Flight | null>(null);
  const follow = useRef<{ layerId: string; entityId: string } | null>(null);
  const syncAccum = useRef(0);
  const scratch = useRef({
    pos: [0, 0, 0] as [number, number, number],
    vec: new Vector3(),
  });

  // Initial position from the (possibly persisted) store snapshot.
  useMemo(() => {
    const snap = engine.store.getState().camera;
    const p = worldAbove(
      snap.lat,
      snap.lon,
      Math.max(snap.altKm, MIN_CAMERA_ALTITUDE_KM),
      engine.time.now(),
    );
    camera.position.copy(p);
    camera.lookAt(0, 0, 0);
  }, [camera, engine]);

  // Fly-to requests from anywhere (search, inspector, plugins).
  useEffect(() => {
    return engine.events.on<FlyToTarget>('core:camera:flyTo', (target) => {
      if (target.follow) {
        follow.current = target.follow;
        flight.current = null;
        return;
      }
      follow.current = null;
      const now = engine.time.now();
      const altKm = target.altKm ?? Math.max(camera.position.length() - GLOBE_RADIUS, 500);
      flight.current = {
        from: camera.position.clone(),
        to: worldAbove(target.lat, target.lon, altKm, now),
        startMs: performance.now(),
        durationMs: target.durationMs ?? 1600,
      };
    });
  }, [engine, camera]);

  // User interaction cancels follow/flight.
  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;
    const onStart = () => {
      follow.current = null;
      flight.current = null;
    };
    controls.addEventListener('start', onStart);
    return () => controls.removeEventListener('start', onStart);
  }, []);

  useFrame((_, delta) => {
    const controls = controlsRef.current;
    const now = engine.time.now();

    // Follow a moving entity via the tracker registry.
    if (follow.current) {
      const trackers = trackersOf(engine);
      const tracker: EntityTracker | undefined = trackers.get(follow.current.layerId);
      if (tracker && tracker(follow.current.entityId, now, scratch.current.pos)) {
        const [x, y, z] = scratch.current.pos;
        const target = scratch.current.vec.set(x, y, z);
        if (controls) {
          controls.target.lerp(target, 0.25);
          const dist = camera.position.distanceTo(controls.target);
          const minDist = 40;
          if (dist < minDist) {
            camera.position.sub(controls.target).setLength(minDist).add(controls.target);
          }
        }
      }
    } else if (controls && controls.target.lengthSq() > 1) {
      // Recenter on the globe when not following.
      controls.target.lerp(scratch.current.vec.set(0, 0, 0), 0.15);
    }

    // Fly-to animation.
    if (flight.current) {
      const f = flight.current;
      const t = MathUtils.clamp((performance.now() - f.startMs) / f.durationMs, 0, 1);
      const eased = t * t * (3 - 2 * t);
      // Slerp direction, lerp radius: smooth arcs around the globe.
      const fromLen = f.from.length();
      const toLen = f.to.length();
      const dir = scratch.current.vec
        .copy(f.from)
        .normalize()
        .lerp(f.to.clone().normalize(), eased)
        .normalize();
      camera.position.copy(dir.multiplyScalar(MathUtils.lerp(fromLen, toLen, eased)));
      if (t >= 1) flight.current = null;
    }

    // Enforce min altitude (jitter guard) even against damping overshoot.
    const distance = camera.position.length();
    const minDistance = GLOBE_RADIUS + MIN_CAMERA_ALTITUDE_KM;
    if (distance < minDistance) {
      camera.position.setLength(minDistance);
    }

    // Dynamic near plane keeps depth precision at every zoom.
    const altitude = camera.position.length() - GLOBE_RADIUS;
    const targetNear = MathUtils.clamp(altitude * 0.15, 2, 20_000);
    if (Math.abs(camera.near - targetNear) / camera.near > 0.1) {
      camera.near = targetNear;
      camera.updateProjectionMatrix();
    }

    controls?.update();

    // Throttled store/event sync.
    syncAccum.current += delta;
    if (syncAccum.current >= STORE_SYNC_INTERVAL_S) {
      syncAccum.current = 0;
      const eci = sceneToEci(camera.position.x, camera.position.y, camera.position.z);
      const ecef = eciToEcefAt(eci[0], eci[1], eci[2], now);
      const geo = ecefToGeodetic(ecef[0], ecef[1], ecef[2]);
      const snap: CameraSnapshot = {
        lat: geo.latDeg,
        lon: geo.lonDeg,
        altKm: Math.max(0, camera.position.length() - GLOBE_RADIUS),
        heading: 0,
        pitch: 0,
      };
      engine.store.getState().setCameraSnapshot(snap);
      engine.events.emit('core:camera:move', snap);
    }
  });

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enableDamping
      dampingFactor={0.08}
      rotateSpeed={0.45}
      zoomSpeed={0.9}
      minDistance={GLOBE_RADIUS + MIN_CAMERA_ALTITUDE_KM}
      maxDistance={MAX_CAMERA_DISTANCE}
      enablePan={false}
    />
  );
}
