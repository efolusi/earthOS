'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import {
  BufferAttribute,
  BufferGeometry,
  Line,
  LineBasicMaterial,
  Raycaster,
  Vector2,
} from 'three';
import type { LayerRenderer, PluginContext, WorkerHandle } from '@earthos/core';
import {
  ExtrapolatedPointsLayer,
  pickExtrapolated,
  pickToleranceRad,
  registerTracker,
} from '@earthos/globe';
import {
  eciToScene,
  orbitalPeriodMin,
  parseOmm,
  propagateTeme,
  satGeodetic,
  type SatRec,
} from '@earthos/gis';
import type { InitResult, OmmRecord, PropagateResult, SatCatalog } from './types';

const SHARD_SIZE = 5_000;
const CAPACITY = 30_000;
/** Refresh a shard when its batch is older than this much SIM time. */
const REFRESH_SIM_MS = 15_000;
/** Wall-clock floor per shard so extreme time rates cannot flood workers. */
const MIN_WALL_REFRESH_MS = 400;
const ORBIT_SAMPLES = 193;
const HOVER_INTERVAL_MS = 50;

interface Shard {
  handle: WorkerHandle;
  offset: number;
  count: number;
  t0SimMs: number;
  lastWallMs: number;
  inflight: boolean;
  ready: boolean;
}

function SatellitesLayer({ ctx }: { ctx: PluginContext }) {
  const gl = useThree((s) => s.gl);
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);

  const [records, setRecords] = useState<SatCatalog>([]);
  const shardsRef = useRef<Shard[]>([]);
  const satrecCache = useRef(new Map<string, SatRec | null>());
  const idToIndex = useRef(new Map<string, number>());
  const selectedIndex = useRef(-1);
  const hoverIndex = useRef(-1);
  const orbitState = useRef<{ satrec: SatRec | null; generatedAtMs: number; periodMs: number }>({
    satrec: null,
    generatedAtMs: 0,
    periodMs: 0,
  });

  const layer = useMemo(
    () =>
      new ExtrapolatedPointsLayer({
        capacity: CAPACITY,
        palette: ['#CE9C66', '#EFCFAC'],
      }),
    [],
  );

  const orbitLine = useMemo(() => {
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(new Float32Array(ORBIT_SAMPLES * 3), 3));
    geometry.setDrawRange(0, 0);
    const line = new Line(
      geometry,
      new LineBasicMaterial({ color: '#EFCFAC', transparent: true, opacity: 0.75 }),
    );
    line.frustumCulled = false;
    return line;
  }, []);

  useEffect(
    () => () => {
      layer.dispose();
      orbitLine.geometry.dispose();
      (orbitLine.material as LineBasicMaterial).dispose();
    },
    [layer, orbitLine],
  );

  // ---------------------------------------------------------------------------
  // Provider data -> records
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const handle = ctx.providers.handle<SatCatalog>('celestrak-gp');
    if (!handle) return;
    const apply = (data: SatCatalog | null) => {
      if (data && data.length > 0) setRecords(data.slice(0, CAPACITY));
    };
    apply(handle.get().data);
    return handle.subscribe((snap) => apply(snap.data));
  }, [ctx]);

  // Settings changes: recolor/resize live, refetch on group change.
  useEffect(() => {
    let prevGroup = (ctx.settings.get() as { group?: string }).group;
    const applyStyle = () => {
      const s = ctx.settings.get() as { pointSize?: number; color?: string };
      if (s.color) layer.setPaletteColor(0, s.color);
      if (s.pointSize) {
        for (let i = 0; i < records.length; i++) {
          if (i !== selectedIndex.current) layer.setMeta(i, 0, s.pointSize, true);
        }
      }
    };
    applyStyle();
    return ctx.settings.subscribe((values) => {
      applyStyle();
      const group = (values as { group?: string }).group;
      if (group !== prevGroup) {
        prevGroup = group;
        ctx.providers.handle('celestrak-gp')?.refresh();
      }
    });
  }, [ctx, layer, records.length]);

  // ---------------------------------------------------------------------------
  // Workers: static shards, one init per catalog
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (records.length === 0) return;
    let disposed = false;
    ctx.logger.debug(`catalog: ${records.length} records, sharding into workers`);

    idToIndex.current.clear();
    satrecCache.current.clear();
    records.forEach((r, i) => idToIndex.current.set(String(r.NORAD_CAT_ID), i));

    const pointSize = (ctx.settings.get() as { pointSize?: number }).pointSize ?? 3;
    layer.setCount(records.length);
    layer.fillMeta(0, records.length, 0, pointSize);

    const shards: Shard[] = [];
    for (let offset = 0; offset < records.length; offset += SHARD_SIZE) {
      const count = Math.min(SHARD_SIZE, records.length - offset);
      const handle = ctx.workers.spawn(
        () =>
          new Worker(new URL('./propagate.worker.js', import.meta.url), {
            type: 'module',
          }),
      );
      const shard: Shard = {
        handle,
        offset,
        count,
        t0SimMs: -Infinity,
        lastWallMs: 0,
        inflight: false,
        ready: false,
      };
      shards.push(shard);
      void handle
        .request<InitResult>('init', { records: records.slice(offset, offset + count) })
        .then((result) => {
          if (!disposed) shard.ready = true;
          ctx.logger.debug(`shard @${offset}: ${result.parsed}/${result.total} satrecs parsed`);
        })
        .catch((err) => ctx.logger.error('shard init failed', err));
    }
    shardsRef.current = shards;

    // Search + inspector integration.
    const disposeSource = ctx.entities.registerSource({
      search: (query, limit) => {
        const q = query.toLowerCase();
        const hits: Array<{
          ref: { layerId: string; entityId: string };
          label: string;
          detail?: string;
          score?: number;
        }> = [];
        for (const r of records) {
          const name = r.OBJECT_NAME ?? '';
          const norad = String(r.NORAD_CAT_ID);
          if (name.toLowerCase().includes(q) || norad === q) {
            hits.push({
              ref: { layerId: ctx.pluginId, entityId: norad },
              label: name || norad,
              detail: `NORAD ${norad}`,
              score: name.toLowerCase().startsWith(q) ? 0.9 : 0.6,
            });
            if (hits.length >= limit) break;
          }
        }
        return hits;
      },
      get: (entityId) => {
        const idx = idToIndex.current.get(entityId);
        if (idx === undefined) return undefined;
        const record = records[idx]!;
        const satrec = getSatrec(entityId, record);
        const now = ctx.time.now();
        const geo = satrec ? satGeodetic(satrec, now) : null;
        return {
          ref: { layerId: ctx.pluginId, entityId },
          label: record.OBJECT_NAME ?? entityId,
          ...(geo ? { position: { lat: geo.latDeg, lon: geo.lonDeg, altKm: geo.altKm } } : {}),
          properties: {
            'NORAD ID': record.NORAD_CAT_ID,
            'Intl designator': record.OBJECT_ID,
            ...(geo
              ? {
                  'Altitude (km)': Math.round(geo.altKm),
                  'Speed (km/s)': Number(geo.speedKms.toFixed(2)),
                  Latitude: Number(geo.latDeg.toFixed(2)),
                  Longitude: Number(geo.lonDeg.toFixed(2)),
                }
              : {}),
            'Period (min)': satrec ? Number(orbitalPeriodMin(satrec).toFixed(1)) : null,
            'TLE epoch': record.EPOCH,
          },
        };
      },
    });

    // Follow-camera tracker.
    const disposeTracker = registerTracker(ctx, (entityId, epochMs, out) => {
      const idx = idToIndex.current.get(entityId);
      if (idx === undefined) return false;
      const satrec = getSatrec(entityId, records[idx]!);
      if (!satrec) return false;
      const state = propagateTeme(satrec, epochMs);
      if (!state) return false;
      eciToScene(state.position[0], state.position[1], state.position[2], out);
      return true;
    });

    function getSatrec(id: string, record: OmmRecord): SatRec | null {
      let satrec = satrecCache.current.get(id);
      if (satrec === undefined) {
        try {
          satrec = parseOmm(record as never);
        } catch {
          satrec = null;
        }
        satrecCache.current.set(id, satrec);
      }
      return satrec;
    }

    return () => {
      disposed = true;
      disposeSource();
      disposeTracker();
      for (const shard of shards) shard.handle.terminate();
      shardsRef.current = [];
    };
  }, [ctx, layer, records]);

  // Force refresh on time jumps/rate changes.
  useEffect(() => {
    return ctx.time.onChange(() => {
      for (const shard of shardsRef.current) shard.t0SimMs = -Infinity;
      orbitState.current.generatedAtMs = 0;
    });
  }, [ctx]);

  // ---------------------------------------------------------------------------
  // Selection: highlight + orbit line + provider of the selected satrec
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const applySelection = (picked: { layerId: string; entityId: string } | null) => {
      if (selectedIndex.current >= 0) layer.setHighlight(selectedIndex.current, 0);
      selectedIndex.current = -1;
      orbitState.current.satrec = null;
      orbitState.current.generatedAtMs = 0;
      orbitLine.geometry.setDrawRange(0, 0);
      if (picked && picked.layerId === ctx.pluginId) {
        const idx = idToIndex.current.get(picked.entityId);
        if (idx !== undefined) {
          selectedIndex.current = idx;
          layer.setHighlight(idx, 1);
          const record = records[idx];
          if (record) {
            let satrec = satrecCache.current.get(picked.entityId);
            if (satrec === undefined) {
              try {
                satrec = parseOmm(record as never);
              } catch {
                satrec = null;
              }
              satrecCache.current.set(picked.entityId, satrec);
            }
            if (satrec) {
              orbitState.current.satrec = satrec;
              orbitState.current.periodMs = orbitalPeriodMin(satrec) * 60_000;
            }
          }
        }
      }
    };
    applySelection(ctx.selection.getSelected());
    let prev = ctx.selection.getSelected();
    // Poll selection through the store subscription (cheap, change-driven).
    const unsub = ctxStoreSubscribe(ctx)((picked) => {
      if (picked !== prev) {
        prev = picked;
        applySelection(picked);
      }
    });
    return unsub;
  }, [ctx, layer, orbitLine, records]);

  // ---------------------------------------------------------------------------
  // Click picking (exactly the GPU's extrapolation math)
  // ---------------------------------------------------------------------------
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
      if (Math.hypot(e.clientX - downX, e.clientY - downY) > 5) return; // drag, not click
      if (shardsRef.current.length === 0) return;
      const rect = dom.getBoundingClientRect();
      ndc.set(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1,
      );
      raycaster.setFromCamera(ndc, camera);
      const o = raycaster.ray.origin;
      const d = raycaster.ray.direction;
      const tol = pickToleranceRad(10, size.height, 50);
      const hit = pickExtrapolated(
        layer.views(),
        layer.nowSec,
        [o.x, o.y, o.z],
        [d.x, d.y, d.z],
        tol,
      );
      if (hit >= 0) {
        const record = records[hit];
        if (record) {
          ctx.selection.select({ layerId: ctx.pluginId, entityId: String(record.NORAD_CAT_ID) });
        }
      }
    };
    let lastHoverAt = 0;
    const onMove = (e: PointerEvent) => {
      const nowWall = performance.now();
      if (nowWall - lastHoverAt < HOVER_INTERVAL_MS) return;
      lastHoverAt = nowWall;
      if (records.length === 0) return;
      const rect = dom.getBoundingClientRect();
      ndc.set(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1,
      );
      raycaster.setFromCamera(ndc, camera);
      const o = raycaster.ray.origin;
      const d = raycaster.ray.direction;
      const hit = pickExtrapolated(
        layer.views(),
        layer.nowSec,
        [o.x, o.y, o.z],
        [d.x, d.y, d.z],
        pickToleranceRad(8, size.height, 50),
      );
      if (hit === hoverIndex.current) return;
      // Never stomp the selection highlight.
      if (hoverIndex.current >= 0 && hoverIndex.current !== selectedIndex.current) {
        layer.setHighlight(hoverIndex.current, 0);
      }
      if (hit >= 0 && hit !== selectedIndex.current) layer.setHighlight(hit, 0.45);
      hoverIndex.current = hit;
      dom.style.cursor = hit >= 0 ? 'pointer' : '';
      const record = hit >= 0 ? records[hit] : undefined;
      ctx.selection.hover(
        record ? { layerId: ctx.pluginId, entityId: String(record.NORAD_CAT_ID) } : null,
      );
    };
    dom.addEventListener('pointerdown', onDown);
    dom.addEventListener('click', onClick);
    dom.addEventListener('pointermove', onMove);
    return () => {
      dom.removeEventListener('pointerdown', onDown);
      dom.removeEventListener('click', onClick);
      dom.removeEventListener('pointermove', onMove);
      dom.style.cursor = '';
      ctx.selection.hover(null);
    };
  }, [gl, camera, size.height, layer, records, ctx]);

  // ---------------------------------------------------------------------------
  // Frame loop: one uniform write + due-shard refresh + orbit maintenance
  // ---------------------------------------------------------------------------
  useFrame(() => {
    const now = ctx.time.now();
    layer.updateTime(now);
    layer.setPixelRatio(gl.getPixelRatio());

    const wallNow = performance.now();
    for (const shard of shardsRef.current) {
      if (!shard.ready || shard.inflight) continue;
      if (
        Math.abs(now - shard.t0SimMs) > REFRESH_SIM_MS &&
        wallNow - shard.lastWallMs > MIN_WALL_REFRESH_MS
      ) {
        shard.inflight = true;
        shard.handle
          .request<PropagateResult>('propagate', { epochMs: now })
          .then((res) => {
            shard.inflight = false;
            shard.t0SimMs = res.epochMs;
            shard.lastWallMs = performance.now();
            layer.writeBatch({
              posVel: res.buffer,
              count: shard.count,
              t0Ms: res.epochMs,
              offset: shard.offset,
            });
            layer.applyValidity(shard.offset, res.valid);
          })
          .catch(() => {
            shard.inflight = false;
          });
      }
    }

    // Orbit line for the selected satellite.
    const orbit = orbitState.current;
    const showOrbit = (ctx.settings.get() as { showOrbit?: boolean }).showOrbit !== false;
    if (orbit.satrec && showOrbit) {
      if (Math.abs(now - orbit.generatedAtMs) > orbit.periodMs / 8) {
        orbit.generatedAtMs = now;
        const attr = orbitLine.geometry.getAttribute('position') as BufferAttribute;
        const arr = attr.array as Float32Array;
        const prev: [number, number, number] = [0, 0, 0];
        for (let k = 0; k < ORBIT_SAMPLES; k++) {
          const t = now + (k / (ORBIT_SAMPLES - 1) - 0.5) * orbit.periodMs;
          const state = propagateTeme(orbit.satrec, t);
          if (state) {
            eciToScene(state.position[0], state.position[1], state.position[2], prev);
          }
          arr[k * 3] = prev[0];
          arr[k * 3 + 1] = prev[1];
          arr[k * 3 + 2] = prev[2];
        }
        attr.needsUpdate = true;
        orbitLine.geometry.setDrawRange(0, ORBIT_SAMPLES);
      }
    } else {
      orbitLine.geometry.setDrawRange(0, 0);
    }
  });

  return (
    <>
      <primitive object={layer.points} />
      <primitive object={orbitLine} />
    </>
  );
}

/** Store-driven selection subscription without pulling zustand hooks here. */
function ctxStoreSubscribe(ctx: PluginContext) {
  return (cb: (picked: { layerId: string; entityId: string } | null) => void) =>
    ctx.events.on<{ layerId: string; entityId: string } | null>('core:selection', cb);
}

const renderer: LayerRenderer = { Component: SatellitesLayer };
export default renderer;
