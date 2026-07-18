'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal, useFrame, useThree } from '@react-three/fiber';
import { Raycaster, Vector2 } from 'three';
import type { LayerRenderer, PluginContext } from '@earthos/core';
import {
  ExtrapolatedPointsLayer,
  localPointToWorld,
  pickExtrapolated,
  pickToleranceRad,
  rayToLocal,
  registerTracker,
  useEarthFixed,
} from '@earthos/globe';
import { geodeticToScene } from '@earthos/gis';
import type { Wildfire, WildfireFeed } from './types';

const CAPACITY = 5_000;
/** fresh (<2d) / recent (<7d) / older — a fire-heat ramp, distinct from quakes. */
const HEAT_PALETTE = ['#FF8A1E', '#FFB454', '#C1662E'];
const DAY_MS = 86_400_000;

function heatIndex(ageMs: number): number {
  if (ageMs < 2 * DAY_MS) return 0;
  if (ageMs < 7 * DAY_MS) return 1;
  return 2;
}

function WildfiresLayer({ ctx }: { ctx: PluginContext }) {
  const earthFixed = useEarthFixed();
  const gl = useThree((s) => s.gl);
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);

  const [fires, setFires] = useState<Wildfire[]>([]);
  const visible = useRef<Wildfire[]>([]);

  const layer = useMemo(
    () => new ExtrapolatedPointsLayer({ capacity: CAPACITY, mu: 0, palette: HEAT_PALETTE }),
    [],
  );
  useEffect(() => () => layer.dispose(), [layer]);

  // Provider data.
  useEffect(() => {
    const handle = ctx.providers.handle<WildfireFeed>('eonet-wildfires');
    if (!handle) return;
    const apply = (feed: WildfireFeed | null) => {
      if (feed) setFires(feed.fires);
    };
    apply(handle.get().data);
    return handle.subscribe((snap) => apply(snap.data));
  }, [ctx]);

  // Live style updates + refetch on window change.
  const [pointSize, setPointSize] = useState(
    () => (ctx.settings.get() as { pointSize?: number }).pointSize ?? 7,
  );
  useEffect(() => {
    let prev = ctx.settings.get() as { status?: string; days?: number; color?: string };
    const applyStyle = () => {
      const s = ctx.settings.get() as { pointSize?: number; color?: string };
      if (s.color) layer.setPaletteColor(0, s.color);
      setPointSize(s.pointSize ?? 7);
    };
    applyStyle();
    return ctx.settings.subscribe((values) => {
      applyStyle();
      const v = values as { status?: string; days?: number };
      if (v.status !== prev.status || v.days !== prev.days) {
        prev = { ...prev, status: v.status, days: v.days };
        ctx.providers.handle('eonet-wildfires')?.refresh();
      }
    });
  }, [ctx, layer]);

  // Write buffers whenever data or size changes.
  useEffect(() => {
    const filtered = fires.slice(0, CAPACITY);
    visible.current = filtered;
    const now = ctx.time.now();

    const posVel = new Float32Array(filtered.length * 6);
    const scratch: [number, number, number] = [0, 0, 0];
    for (let i = 0; i < filtered.length; i++) {
      geodeticToScene(filtered[i]!.lat, filtered[i]!.lon, 4, scratch);
      posVel[i * 6] = scratch[0];
      posVel[i * 6 + 1] = scratch[1];
      posVel[i * 6 + 2] = scratch[2];
    }
    layer.writeBatch({ posVel, count: filtered.length, t0Ms: now, offset: 0 });
    layer.setCount(filtered.length);
    for (let i = 0; i < filtered.length; i++) {
      layer.setMeta(i, heatIndex(Math.max(0, now - filtered[i]!.date)), pointSize, true);
    }

    const idToIndex = new Map(filtered.map((f, i) => [f.id, i]));
    const disposeTracker = registerTracker(ctx, (entityId, _epochMs, out) => {
      const idx = idToIndex.get(entityId);
      if (idx === undefined || !earthFixed) return false;
      const v = layer.views();
      const b = idx * 3;
      localPointToWorld(earthFixed, v.position[b]!, v.position[b + 1]!, v.position[b + 2]!, out);
      return true;
    });

    const disposeSource = ctx.entities.registerSource({
      search: (query, limit) => {
        const q = query.toLowerCase();
        return filtered
          .filter((f) => f.title.toLowerCase().includes(q))
          .slice(0, limit)
          .map((f) => ({
            ref: { layerId: ctx.pluginId, entityId: f.id },
            label: f.title,
            detail: new Date(f.date).toUTCString(),
            score: 0.6,
          }));
      },
      get: (entityId) => {
        const f = filtered.find((x) => x.id === entityId);
        if (!f) return undefined;
        return {
          ref: { layerId: ctx.pluginId, entityId },
          label: f.title,
          position: { lat: f.lat, lon: f.lon, altKm: 0 },
          properties: {
            Event: f.title,
            'Last detected': new Date(f.date).toUTCString(),
            Latitude: Number(f.lat.toFixed(3)),
            Longitude: Number(f.lon.toFixed(3)),
            Source: 'NASA EONET',
          },
        };
      },
    });
    return () => {
      disposeSource();
      disposeTracker();
    };
  }, [ctx, layer, fires, pointSize, earthFixed]);

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
      const fire = hit >= 0 ? visible.current[hit] : undefined;
      if (fire) ctx.selection.select({ layerId: ctx.pluginId, entityId: fire.id });
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

const renderer: LayerRenderer = { Component: WildfiresLayer };
export default renderer;
