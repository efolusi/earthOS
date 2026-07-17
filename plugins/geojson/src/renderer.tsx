'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal, useFrame, useThree } from '@react-three/fiber';
import { BufferAttribute, BufferGeometry, Color, LineBasicMaterial, LineSegments } from 'three';
import type { FeatureCollection } from 'geojson';
import type { LayerRenderer, PluginContext } from '@earthos/core';
import { ExtrapolatedPointsLayer, useEarthFixed } from '@earthos/globe';
import { buildGeometry, type BuiltGeometry } from './build-geometry';

const CAPACITY = 50_000;

interface GeoJsonSettings {
  url?: string;
  color?: string;
  pointSize?: number;
  altitudeKm?: number;
}

function GeoJsonLayer({ ctx }: { ctx: PluginContext }) {
  const earthFixed = useEarthFixed();
  const gl = useThree((s) => s.gl);
  const [collection, setCollection] = useState<FeatureCollection | null>(null);
  const [built, setBuilt] = useState<BuiltGeometry | null>(null);

  const layer = useMemo(
    () => new ExtrapolatedPointsLayer({ capacity: CAPACITY, mu: 0, palette: ['#5FB86E'] }),
    [],
  );
  const lines = useMemo(() => {
    const geometry = new BufferGeometry();
    const material = new LineBasicMaterial({ color: '#5FB86E', transparent: true, opacity: 0.85 });
    const segments = new LineSegments(geometry, material);
    segments.frustumCulled = false;
    return segments;
  }, []);

  useEffect(
    () => () => {
      layer.dispose();
      lines.geometry.dispose();
      (lines.material as LineBasicMaterial).dispose();
    },
    [layer, lines],
  );

  // Provider data.
  useEffect(() => {
    const handle = ctx.providers.handle<FeatureCollection>('geojson-source');
    if (!handle) return;
    const apply = (data: FeatureCollection | null) => {
      if (data) setCollection(data);
    };
    apply(handle.get().data);
    return handle.subscribe((snap) => apply(snap.data));
  }, [ctx]);

  // Settings: url change refetches; style changes rebuild/recolor.
  useEffect(() => {
    let prev = ctx.settings.get() as GeoJsonSettings;
    return ctx.settings.subscribe((values) => {
      const next = values as GeoJsonSettings;
      if (next.url !== prev.url) ctx.providers.handle('geojson-source')?.refresh();
      if (next.altitudeKm !== prev.altitudeKm) setCollection((c) => (c ? { ...c } : c));
      prev = next;
    });
  }, [ctx]);

  // Rebuild scene buffers when data or altitude changes.
  useEffect(() => {
    if (!collection) return;
    const s = ctx.settings.get() as GeoJsonSettings;
    const result = buildGeometry(collection, s.altitudeKm ?? 8);
    setBuilt(result);

    const pointCount = result.pointLabels.length;
    layer.writeBatch({
      posVel: result.pointsPosVel,
      count: pointCount,
      t0Ms: ctx.time.now(),
      offset: 0,
    });
    layer.setCount(pointCount);
    layer.fillMeta(0, pointCount, 0, s.pointSize ?? 5);

    lines.geometry.setAttribute('position', new BufferAttribute(result.linePositions, 3));
    lines.geometry.setDrawRange(0, result.linePositions.length / 3);

    const disposeSource = ctx.entities.registerSource({
      search: (query, limit) => {
        const q = query.toLowerCase();
        const hits: Array<{
          ref: { layerId: string; entityId: string };
          label: string;
          score?: number;
        }> = [];
        for (let i = 0; i < result.pointLabels.length; i++) {
          if (result.pointLabels[i]!.toLowerCase().includes(q)) {
            hits.push({
              ref: { layerId: ctx.pluginId, entityId: String(i) },
              label: result.pointLabels[i]!,
              score: 0.5,
            });
            if (hits.length >= limit) break;
          }
        }
        return hits;
      },
      get: (entityId) => {
        const i = Number(entityId);
        const label = result.pointLabels[i];
        const coords = result.pointCoords[i];
        if (label === undefined || !coords) return undefined;
        return {
          ref: { layerId: ctx.pluginId, entityId },
          label,
          position: { lat: coords[1], lon: coords[0], altKm: 0 },
          properties: { Longitude: coords[0], Latitude: coords[1] },
        };
      },
    });
    return disposeSource;
  }, [ctx, layer, lines, collection]);

  // Live recolor/resize.
  useEffect(() => {
    const applyStyle = (values: GeoJsonSettings) => {
      if (values.color) {
        layer.setPaletteColor(0, values.color);
        (lines.material as LineBasicMaterial).color = new Color(values.color);
      }
      if (values.pointSize && built) {
        layer.fillMeta(0, built.pointLabels.length, 0, values.pointSize);
      }
    };
    applyStyle(ctx.settings.get() as GeoJsonSettings);
    return ctx.settings.subscribe((v) => applyStyle(v as GeoJsonSettings));
  }, [ctx, layer, lines, built]);

  useFrame(() => {
    layer.updateTime(ctx.time.now());
    layer.setPixelRatio(gl.getPixelRatio());
  });

  if (!earthFixed) return null;
  return createPortal(
    <>
      <primitive object={layer.points} />
      <primitive object={lines} />
    </>,
    earthFixed,
  );
}

const renderer: LayerRenderer = { Component: GeoJsonLayer };
export default renderer;
