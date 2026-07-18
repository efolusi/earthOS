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
import { enuVelocityToScene, geodeticToScene } from '@earthos/gis';
import { icaoHexToCountry } from './icao-country';
import type { AircraftFeed, AircraftState } from './types';

const CAPACITY = 30_000;
/**
 * Dead reckoning is only honest near the feed's own epoch: beyond this
 * window (time scrub, very stale data) positions freeze instead of flying
 * off along straight lines. A sim-time-aware data contract is roadmap work.
 */
const MAX_EXTRAPOLATION_MS = 5 * 60_000;
const HOVER_INTERVAL_MS = 50;

interface AircraftSettings {
  pointSize?: number;
  color?: string;
  showOnGround?: boolean;
}

/**
 * Aircraft reuse the shared points pipeline with mu = 0 in the earth-fixed
 * frame: each poll writes position + ENU-derived velocity, and the GPU
 * dead-reckons along the track between polls. ~15k aircraft = one draw call.
 */
function AircraftLayer({ ctx }: { ctx: PluginContext }) {
  const earthFixed = useEarthFixed();
  const gl = useThree((s) => s.gl);
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);

  const [feed, setFeed] = useState<AircraftFeed | null>(null);
  const visible = useRef<AircraftState[]>([]);
  const icaoToIndex = useRef(new Map<string, number>());
  const feedEpochMs = useRef<number | null>(null);
  const hoverIndex = useRef(-1);
  const selectedIdx = useRef(-1);
  const [showOnGround, setShowOnGround] = useState(
    () => (ctx.settings.get() as AircraftSettings).showOnGround ?? false,
  );

  const layer = useMemo(
    () =>
      new ExtrapolatedPointsLayer({
        capacity: CAPACITY,
        mu: 0,
        // Sky cyan, distinct from the gold satellite dots: aircraft own the
        // "in the atmosphere" hue, read clearly against land and ocean.
        palette: ['#5EC8E6', '#B8ECF7'],
        shape: 'arrow',
      }),
    [],
  );
  useEffect(() => () => layer.dispose(), [layer]);

  // Provider data.
  useEffect(() => {
    const handle = ctx.providers.handle<AircraftFeed>('opensky-states');
    if (!handle) return;
    const apply = (data: AircraftFeed | null) => {
      if (data) setFeed(data);
    };
    apply(handle.get().data);
    return handle.subscribe((snap) => apply(snap.data));
  }, [ctx]);

  // Live style updates + filter changes.
  useEffect(() => {
    const applyStyle = (values: AircraftSettings) => {
      if (values.color) layer.setPaletteColor(0, values.color);
      setShowOnGround(values.showOnGround ?? false);
    };
    applyStyle(ctx.settings.get() as AircraftSettings);
    return ctx.settings.subscribe((v) => applyStyle(v as AircraftSettings));
  }, [ctx, layer]);

  // Write buffers per poll: position + dead-reckoning velocity.
  useEffect(() => {
    if (!feed) return;
    const s = ctx.settings.get() as AircraftSettings;
    const filtered = feed.states.filter((a) => showOnGround || !a.onGround).slice(0, CAPACITY);
    visible.current = filtered;
    feedEpochMs.current = feed.time * 1000;
    icaoToIndex.current = new Map(filtered.map((a, i) => [a.icao24, i]));
    hoverIndex.current = -1;

    const posVel = new Float32Array(filtered.length * 6);
    const pos: [number, number, number] = [0, 0, 0];
    const vel: [number, number, number] = [0, 0, 0];
    for (let i = 0; i < filtered.length; i++) {
      const a = filtered[i]!;
      geodeticToScene(a.lat, a.lon, Math.max(a.altM, 0) / 1000, pos);
      const track = (a.trackDeg * Math.PI) / 180;
      const speedKms = a.velocityMs / 1000;
      enuVelocityToScene(
        a.lat,
        a.lon,
        speedKms * Math.sin(track),
        speedKms * Math.cos(track),
        a.verticalRateMs / 1000,
        vel,
      );
      const base = i * 6;
      posVel[base] = pos[0];
      posVel[base + 1] = pos[1];
      posVel[base + 2] = pos[2];
      posVel[base + 3] = vel[0];
      posVel[base + 4] = vel[1];
      posVel[base + 5] = vel[2];
    }
    // OpenSky timestamps the snapshot; dead-reckon from that sim epoch.
    layer.writeBatch({
      posVel,
      count: filtered.length,
      t0Ms: feed.time * 1000,
      offset: 0,
    });
    layer.setCount(filtered.length);
    layer.fillMeta(0, filtered.length, 0, s.pointSize ?? 3.5);

    const disposeSource = ctx.entities.registerSource({
      search: (query, limit) => {
        const q = query.toLowerCase();
        const hits = [];
        for (let i = 0; i < filtered.length; i++) {
          const a = filtered[i]!;
          if (a.callsign.toLowerCase().includes(q) || a.icao24 === q) {
            hits.push({
              ref: { layerId: ctx.pluginId, entityId: a.icao24 },
              label: a.callsign || a.icao24.toUpperCase(),
              detail: a.country || icaoHexToCountry(a.icao24) || a.airframe,
              score: a.callsign.toLowerCase().startsWith(q) ? 0.85 : 0.55,
            });
            if (hits.length >= limit) break;
          }
        }
        return hits;
      },
      get: (entityId) => {
        const a = filtered.find((x) => x.icao24 === entityId);
        if (!a) return undefined;
        return {
          ref: { layerId: ctx.pluginId, entityId },
          label: a.callsign || a.icao24.toUpperCase(),
          position: { lat: a.lat, lon: a.lon, altKm: a.altM / 1000 },
          properties: {
            Callsign: a.callsign || null,
            'ICAO 24': a.icao24.toUpperCase(),
            Country: a.country || icaoHexToCountry(a.icao24) || null,
            Airframe: a.airframe || null,
            'Altitude (ft)': Math.round(a.altM * 3.28084),
            'Speed (kt)': Math.round(a.velocityMs * 1.94384),
            'Heading (deg)': Math.round(a.trackDeg),
            'Vertical rate (m/s)': Number(a.verticalRateMs.toFixed(1)),
            Status: a.onGround ? 'on ground' : 'airborne',
          },
        };
      },
    });

    // Follow camera: dead-reckon on the CPU with the same math as the GPU.
    const disposeTracker = registerTracker(ctx, (entityId, epochMs, out) => {
      const idx = icaoToIndex.current.get(entityId) ?? -1;
      if (idx < 0 || !earthFixed) return false;
      const v = layer.views();
      const clampedMs = Math.min(
        Math.max(epochMs, feed.time * 1000 - MAX_EXTRAPOLATION_MS),
        feed.time * 1000 + MAX_EXTRAPOLATION_MS,
      );
      const dt = (clampedMs - feed.time * 1000) / 1000;
      const b = idx * 3;
      // Local earth-fixed position; transform to world via the group matrix.
      localPointToWorld(
        earthFixed,
        v.position[b]! + v.vel[b]! * dt,
        v.position[b + 1]! + v.vel[b + 1]! * dt,
        v.position[b + 2]! + v.vel[b + 2]! * dt,
        out,
      );
      return true;
    });

    return () => {
      disposeSource();
      disposeTracker();
    };
  }, [ctx, layer, feed, showOnGround, earthFixed]);

  // Selection highlight (the on-globe marker rides the tracker; the dot
  // itself also brightens so the pair reads as one indicator).
  useEffect(() => {
    const apply = (picked: { layerId: string; entityId: string } | null) => {
      if (selectedIdx.current >= 0) layer.setHighlight(selectedIdx.current, 0);
      selectedIdx.current = -1;
      if (picked && picked.layerId === ctx.pluginId) {
        const idx = icaoToIndex.current.get(picked.entityId) ?? -1;
        if (idx >= 0) {
          selectedIdx.current = idx;
          layer.setHighlight(idx, 1);
        }
      }
    };
    apply(ctx.selection.getSelected());
    return ctx.events.on<{ layerId: string; entityId: string } | null>('core:selection', apply);
  }, [ctx, layer, feed]);

  // Click picking in the rotating frame.
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
      const aircraft = hit >= 0 ? visible.current[hit] : undefined;
      if (aircraft) ctx.selection.select({ layerId: ctx.pluginId, entityId: aircraft.icao24 });
    };
    let lastHoverAt = 0;
    const onMove = (e: PointerEvent) => {
      const nowWall = performance.now();
      if (nowWall - lastHoverAt < HOVER_INTERVAL_MS) return;
      lastHoverAt = nowWall;
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
        pickToleranceRad(8, size.height, 50),
      );
      if (hit === hoverIndex.current) return;
      if (hoverIndex.current >= 0 && hoverIndex.current !== selectedIdx.current) {
        layer.setHighlight(hoverIndex.current, 0);
      }
      if (hit >= 0 && hit !== selectedIdx.current) layer.setHighlight(hit, 0.45);
      hoverIndex.current = hit;
      dom.style.cursor = hit >= 0 ? 'pointer' : '';
      const aircraft = hit >= 0 ? visible.current[hit] : undefined;
      ctx.selection.hover(aircraft ? { layerId: ctx.pluginId, entityId: aircraft.icao24 } : null);
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
  }, [gl, camera, size.height, layer, ctx, earthFixed]);

  useFrame(() => {
    // Clamp extrapolation to the honest window around the feed epoch.
    const now = ctx.time.now();
    const t0 = feedEpochMs.current;
    layer.updateTime(
      t0 === null
        ? now
        : Math.min(Math.max(now, t0 - MAX_EXTRAPOLATION_MS), t0 + MAX_EXTRAPOLATION_MS),
    );
    layer.setPixelRatio(gl.getPixelRatio());
    layer.setAspect(size.width / size.height);
  });

  if (!earthFixed) return null;
  return createPortal(<primitive object={layer.points} />, earthFixed);
}

const renderer: LayerRenderer = { Component: AircraftLayer };
export default renderer;
