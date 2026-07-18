'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal, useFrame, useThree } from '@react-three/fiber';
import { Vector3 } from 'three';
import type { LayerRenderer, PluginContext } from '@earthos/core';
import { useEarthFixed } from '@earthos/globe';
import {
  ecefToScene,
  eciToEcefAt,
  equatorialToSceneDir,
  sceneToEci,
  sunEquatorial,
} from '@earthos/gis';
import { TileEngine } from './tile-engine';
import type { ImageryDescriptor } from './provider';

/** Refinement cadence: streaming decisions do not belong in the frame loop. */
const UPDATE_INTERVAL_S = 0.25;

function ImageryLayer({ ctx }: { ctx: PluginContext }) {
  const earthFixed = useEarthFixed();
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const [descriptor, setDescriptor] = useState<ImageryDescriptor | null>(null);
  const accum = useRef(UPDATE_INTERVAL_S); // fire on the first frame
  const scratch = useRef({ cam: new Vector3(), sunDir: [0, 0, 0] as [number, number, number] });

  useEffect(() => {
    const handle = ctx.providers.handle<ImageryDescriptor>('imagery-tiles');
    if (!handle) return;
    const apply = (data: ImageryDescriptor | null) => {
      if (data) setDescriptor(data);
    };
    apply(handle.get().data);
    return handle.subscribe((snap) => apply(snap.data));
  }, [ctx]);

  // Settings changes re-describe the source.
  useEffect(
    () => ctx.settings.subscribe(() => ctx.providers.handle('imagery-tiles')?.refresh()),
    [ctx],
  );

  const engine = useMemo(() => new TileEngine('', 12), []);
  useEffect(() => () => engine.disposeAll(), [engine]);

  useEffect(() => {
    if (descriptor) engine.setSource(descriptor.template, descriptor.maxZoom);
  }, [engine, descriptor]);

  useFrame((_, delta) => {
    if (!earthFixed || !descriptor) return;
    accum.current += delta;
    if (accum.current < UPDATE_INTERVAL_S) return;
    accum.current = 0;

    const now = ctx.time.now();
    // Camera into the earth-fixed local frame.
    earthFixed.updateMatrixWorld();
    const cam = scratch.current.cam.copy(camera.position);
    earthFixed.worldToLocal(cam);

    // Sun direction in the local frame (world sun rotated by -gmst).
    const sunWorld = equatorialToSceneDir(sunEquatorial(now));
    const sunEci = sceneToEci(sunWorld[0], sunWorld[1], sunWorld[2]);
    const sunEcef = eciToEcefAt(sunEci[0], sunEci[1], sunEci[2], now);
    ecefToScene(sunEcef[0], sunEcef[1], sunEcef[2], scratch.current.sunDir);
    engine.setSunDirLocal(...scratch.current.sunDir);

    engine.update([cam.x, cam.y, cam.z], size.height, 50);
  });

  if (!earthFixed) return null;
  return createPortal(<primitive object={engine.group} />, earthFixed);
}

const renderer: LayerRenderer = { Component: ImageryLayer };
export default renderer;
