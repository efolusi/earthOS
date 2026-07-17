'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal, useFrame, useThree } from '@react-three/fiber';
import type { LayerRenderer, PluginContext } from '@earthos/core';
import { ExtrapolatedPointsLayer, useEarthFixed } from '@earthos/globe';
import { geodeticToScene } from '@earthos/gis';
import type { Capital } from './provider';

function CapitalsLayer({ ctx }: { ctx: PluginContext }) {
  const earthFixed = useEarthFixed();
  const gl = useThree((s) => s.gl);
  const [capitals, setCapitals] = useState<Capital[]>([]);

  const layer = useMemo(
    () => new ExtrapolatedPointsLayer({ capacity: 500, mu: 0, palette: ['#DFB585'] }),
    [],
  );
  useEffect(() => () => layer.dispose(), [layer]);

  useEffect(() => {
    const handle = ctx.providers.handle<Capital[]>('capitals');
    if (!handle) return;
    const apply = (data: Capital[] | null) => data && setCapitals(data);
    apply(handle.get().data);
    return handle.subscribe((snap) => apply(snap.data));
  }, [ctx]);

  useEffect(() => {
    const s = ctx.settings.get() as { pointSize?: number; color?: string };
    if (s.color) layer.setPaletteColor(0, s.color);
    const posVel = new Float32Array(capitals.length * 6);
    const scratch: [number, number, number] = [0, 0, 0];
    capitals.forEach((capital, i) => {
      geodeticToScene(capital.lat, capital.lon, 10, scratch);
      posVel.set(scratch, i * 6);
    });
    layer.writeBatch({ posVel, count: capitals.length, t0Ms: ctx.time.now(), offset: 0 });
    layer.setCount(capitals.length);
    layer.fillMeta(0, capitals.length, 0, s.pointSize ?? 6);

    return ctx.entities.registerSource({
      search: (query, limit) =>
        capitals
          .map((capital, i) => ({ capital, i }))
          .filter(({ capital }) =>
            `${capital.name} ${capital.country}`.toLowerCase().includes(query.toLowerCase()),
          )
          .slice(0, limit)
          .map(({ capital, i }) => ({
            ref: { layerId: ctx.pluginId, entityId: String(i) },
            label: capital.name,
            detail: capital.country,
            score: 0.7,
          })),
      get: (entityId) => {
        const capital = capitals[Number(entityId)];
        if (!capital) return undefined;
        return {
          ref: { layerId: ctx.pluginId, entityId },
          label: capital.name,
          position: { lat: capital.lat, lon: capital.lon, altKm: 0 },
          properties: { Country: capital.country, Latitude: capital.lat, Longitude: capital.lon },
        };
      },
    });
  }, [ctx, layer, capitals]);

  useFrame(() => {
    layer.updateTime(ctx.time.now());
    layer.setPixelRatio(gl.getPixelRatio());
  });

  if (!earthFixed) return null;
  return createPortal(<primitive object={layer.points} />, earthFixed);
}

const renderer: LayerRenderer = { Component: CapitalsLayer };
export default renderer;
