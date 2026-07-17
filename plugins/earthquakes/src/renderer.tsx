'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal, useFrame, useThree } from '@react-three/fiber';
import { Raycaster, Vector2 } from 'three';
import type { LayerRenderer, PluginContext } from '@earthos/core';
import {
  ExtrapolatedPointsLayer,
  pickExtrapolated,
  pickToleranceRad,
  rayToLocal,
  useEarthFixed,
} from '@earthos/globe';
import { geodeticToScene } from '@earthos/gis';
import type { QuakeFeed, UsgsFeature } from './types';

const CAPACITY = 20_000;

/** Palette: shallow / intermediate / deep focus. */
const DEPTH_PALETTE = ['#f87171', '#fb923c', '#a78bfa'];

function depthPaletteIndex(depthKm: number): number {
  if (depthKm < 70) return 0;
  if (depthKm < 300) return 1;
  return 2;
}

function magnitudeSize(mag: number | null): number {
  return Math.min(14, Math.max(2.5, 1.5 + (mag ?? 0) * 1.6));
}

function EarthquakesLayer({ ctx }: { ctx: PluginContext }) {
  const earthFixed = useEarthFixed();
  const gl = useThree((s) => s.gl);
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);

  const [features, setFeatures] = useState<UsgsFeature[]>([]);
  const visible = useRef<UsgsFeature[]>([]);

  const layer = useMemo(
    () => new ExtrapolatedPointsLayer({ capacity: CAPACITY, mu: 0, palette: DEPTH_PALETTE }),
    [],
  );
  useEffect(() => () => layer.dispose(), [layer]);

  // Provider data.
  useEffect(() => {
    const handle = ctx.providers.handle<QuakeFeed>('usgs-quakes');
    if (!handle) return;
    const apply = (feed: QuakeFeed | null) => {
      if (feed) setFeatures(feed.features);
    };
    apply(handle.get().data);
    return handle.subscribe((snap) => apply(snap.data));
  }, [ctx]);

  // Settings changes refetch (feed window) and refilter (magnitude).
  const [minMag, setMinMag] = useState(
    () => (ctx.settings.get() as { minMagnitude?: number }).minMagnitude ?? 2.5,
  );
  useEffect(() => {
    let prevFeed = (ctx.settings.get() as { feed?: string }).feed;
    return ctx.settings.subscribe((values) => {
      const v = values as { feed?: string; minMagnitude?: number };
      setMinMag(v.minMagnitude ?? 2.5);
      if (v.feed !== prevFeed) {
        prevFeed = v.feed;
        ctx.providers.handle('usgs-quakes')?.refresh();
      }
    });
  }, [ctx]);

  // Write buffers whenever data or filter changes.
  useEffect(() => {
    const filtered = features
      .filter((f) => (f.properties.mag ?? -10) >= minMag)
      .slice(0, CAPACITY);
    visible.current = filtered;

    const posVel = new Float32Array(filtered.length * 6);
    const scratch: [number, number, number] = [0, 0, 0];
    for (let i = 0; i < filtered.length; i++) {
      const [lon, lat] = filtered[i]!.geometry.coordinates;
      geodeticToScene(lat, lon, 4, scratch); // 4 km above the surface: no z-fighting
      posVel[i * 6] = scratch[0];
      posVel[i * 6 + 1] = scratch[1];
      posVel[i * 6 + 2] = scratch[2];
      // velocities stay zero: static, earth-fixed
    }
    layer.writeBatch({ posVel, count: filtered.length, t0Ms: ctx.time.now(), offset: 0 });
    layer.setCount(filtered.length);
    for (let i = 0; i < filtered.length; i++) {
      const f = filtered[i]!;
      layer.setMeta(
        i,
        depthPaletteIndex(f.geometry.coordinates[2] ?? 0),
        magnitudeSize(f.properties.mag),
        true,
      );
    }

    const disposeSource = ctx.entities.registerSource({
      search: (query, limit) => {
        const q = query.toLowerCase();
        return filtered
          .filter((f) => (f.properties.place ?? '').toLowerCase().includes(q))
          .slice(0, limit)
          .map((f) => ({
            ref: { layerId: ctx.pluginId, entityId: f.id },
            label: `M${(f.properties.mag ?? 0).toFixed(1)} ${f.properties.place ?? 'unknown'}`,
            detail: new Date(f.properties.time).toUTCString(),
            score: Math.min(1, (f.properties.mag ?? 0) / 10),
          }));
      },
      get: (entityId) => {
        const f = filtered.find((x) => x.id === entityId);
        if (!f) return undefined;
        const [lon, lat, depth] = f.geometry.coordinates;
        return {
          ref: { layerId: ctx.pluginId, entityId },
          label: `M${(f.properties.mag ?? 0).toFixed(1)} ${f.properties.place ?? ''}`,
          position: { lat, lon, altKm: 0 },
          properties: {
            Magnitude: f.properties.mag,
            'Depth (km)': Math.round(depth ?? 0),
            Time: new Date(f.properties.time).toUTCString(),
            Latitude: Number(lat.toFixed(3)),
            Longitude: Number(lon.toFixed(3)),
            Details: f.properties.url,
          },
        };
      },
    });
    return disposeSource;
  }, [ctx, layer, features, minMag]);

  // Click picking (ray transformed into the rotating earth-fixed frame).
  useEffect(() => {
    const dom = gl.domElement;
    const raycaster = new Raycaster();
    const ndc = new Vector2();
    let downX = 0;
    let downY = 0;
    const onDown = (e: PointerEvent) => {
      downX = e.clientX;
      downY = e.clientY;
    };
    const onClick = (e: MouseEvent) => {
      if (Math.hypot(e.clientX - downX, e.clientY - downY) > 5) return;
      if (!earthFixed || visible.current.length === 0) return;
      const rect = dom.getBoundingClientRect();
      ndc.set(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1,
      );
      raycaster.setFromCamera(ndc, camera);
      const o = raycaster.ray.origin;
      const d = raycaster.ray.direction;
      const local = rayToLocal(earthFixed, [o.x, o.y, o.z], [d.x, d.y, d.z]);
      const hit = pickExtrapolated(
        layer.views(),
        layer.nowSec,
        local.origin,
        local.dir,
        pickToleranceRad(10, size.height, 50),
      );
      const feature = hit >= 0 ? visible.current[hit] : undefined;
      if (feature) ctx.selection.select({ layerId: ctx.pluginId, entityId: feature.id });
    };
    dom.addEventListener('pointerdown', onDown);
    dom.addEventListener('click', onClick);
    return () => {
      dom.removeEventListener('pointerdown', onDown);
      dom.removeEventListener('click', onClick);
    };
  }, [gl, camera, size.height, layer, ctx, earthFixed]);

  useFrame(() => {
    layer.updateTime(ctx.time.now());
    layer.setPixelRatio(gl.getPixelRatio());
  });

  if (!earthFixed) return null;
  return createPortal(<primitive object={layer.points} />, earthFixed);
}

const renderer: LayerRenderer = { Component: EarthquakesLayer };
export default renderer;
