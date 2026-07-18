'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal, useFrame, useThree } from '@react-three/fiber';
import type { LayerRenderer, PluginContext } from '@earthos/core';
import {
  ExtrapolatedPointsLayer,
  localPointToWorld,
  registerTracker,
  useEarthFixed,
} from '@earthos/globe';
import { geodeticToScene } from '@earthos/gis';
import type { Storm, StormFeed } from './types';

/** danger for hurricanes, warning for storms, sand for depressions */
const PALETTE = ['#E85D4A', '#D9822B', '#9C9280'];

function paletteFor(storm: Storm): number {
  if (storm.classification.startsWith('HU') || storm.intensityKt >= 64) return 0;
  if (storm.intensityKt >= 34) return 1;
  return 2;
}

function HurricanesLayer({ ctx }: { ctx: PluginContext }) {
  const earthFixed = useEarthFixed();
  const gl = useThree((s) => s.gl);
  const [storms, setStorms] = useState<Storm[]>([]);

  const layer = useMemo(
    () => new ExtrapolatedPointsLayer({ capacity: 100, mu: 0, palette: PALETTE }),
    [],
  );
  useEffect(() => () => layer.dispose(), [layer]);

  useEffect(() => {
    const handle = ctx.providers.handle<StormFeed>('nhc-storms');
    if (!handle) return;
    const apply = (data: StormFeed | null) => {
      if (data) setStorms(data.storms);
    };
    apply(handle.get().data);
    return handle.subscribe((snap) => apply(snap.data));
  }, [ctx]);

  useEffect(() => {
    const posVel = new Float32Array(storms.length * 6);
    const scratch: [number, number, number] = [0, 0, 0];
    storms.forEach((storm, i) => {
      geodeticToScene(storm.lat, storm.lon, 12, scratch);
      posVel.set(scratch, i * 6);
    });
    layer.writeBatch({ posVel, count: storms.length, t0Ms: ctx.time.now(), offset: 0 });
    layer.setCount(storms.length);
    storms.forEach((storm, i) => {
      layer.setMeta(i, paletteFor(storm), Math.min(16, 8 + storm.intensityKt / 12), true);
    });

    const disposeTracker = registerTracker(ctx, (entityId, _epoch, out) => {
      const idx = storms.findIndex((s) => s.id === entityId);
      if (idx < 0 || !earthFixed) return false;
      const v = layer.views();
      const b = idx * 3;
      localPointToWorld(earthFixed, v.position[b]!, v.position[b + 1]!, v.position[b + 2]!, out);
      return true;
    });

    const disposeSource = ctx.entities.registerSource({
      search: (query, limit) =>
        storms
          .filter((s) => s.name.toLowerCase().includes(query.toLowerCase()))
          .slice(0, limit)
          .map((s) => ({
            ref: { layerId: ctx.pluginId, entityId: s.id },
            label: `${s.classification} ${s.name}`,
            detail: `${s.intensityKt} kt`,
            score: 0.8,
          })),
      get: (entityId) => {
        const s = storms.find((x) => x.id === entityId);
        if (!s) return undefined;
        return {
          ref: { layerId: ctx.pluginId, entityId },
          label: `${s.classification} ${s.name}`,
          position: { lat: s.lat, lon: s.lon, altKm: 0 },
          properties: {
            Classification: s.classification,
            'Max winds (kt)': s.intensityKt,
            Movement:
              s.movementDir !== null && s.movementKt !== null
                ? `${s.movementDir} deg at ${s.movementKt} kt`
                : null,
            Updated: s.lastUpdate,
            Latitude: s.lat,
            Longitude: s.lon,
          },
        };
      },
    });

    return () => {
      disposeTracker();
      disposeSource();
    };
  }, [ctx, layer, storms, earthFixed]);

  useFrame(() => {
    layer.updateTime(ctx.time.now());
    layer.setPixelRatio(gl.getPixelRatio());
  });

  if (!earthFixed) return null;
  return createPortal(<primitive object={layer.points} />, earthFixed);
}

const renderer: LayerRenderer = { Component: HurricanesLayer };
export default renderer;
