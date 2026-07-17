'use client';

import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { createEarthEngine, DEFAULT_CAMERA, type EarthEngine } from '@earthos/core';
import { EarthEngineProvider } from '@earthos/core/react';
import { createDefaultCache } from '@earthos/providers';
import { EarthCanvas, type GlobeTextureUrls } from '@earthos/globe';

export interface EarthProps {
  /** Bring your own engine (headless setups); defaults to a fresh one. */
  engine?: EarthEngine;
  /** Starting camera; ignored when a persisted camera exists. */
  initialCamera?: { lat: number; lon: number; altKm: number };
  /** Simulation rate at boot (1 = live). */
  timeRate?: number;
  /** Earth texture URLs; omit for the stylized procedural globe. */
  textures?: GlobeTextureUrls;
  stars?: boolean;
  moon?: boolean;
  /** localStorage persistence key; false disables persistence. */
  persistKey?: string | false;
  className?: string;
  style?: CSSProperties;
  /** <Layer/> components and any custom UI bound to the engine. */
  children?: ReactNode;
}

/**
 * The composable Earth. Children are DOM-side controllers ( <Layer/>,
 * custom panels via the earthos hooks); the WebGL canvas mounts client-side
 * only, so this component is safe to render from any SSR framework.
 */
export function Earth({
  engine: engineProp,
  initialCamera,
  timeRate,
  textures,
  stars,
  moon,
  persistKey,
  className,
  style,
  children,
}: EarthProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const engine = useMemo(() => {
    if (engineProp) return engineProp;
    const created = createEarthEngine({ cache: createDefaultCache(), persistKey });
    if (initialCamera) {
      const state = created.store.getState();
      // Seed only when no camera was persisted (still exactly the default).
      const cam = state.camera;
      const fresh =
        cam.lat === DEFAULT_CAMERA.lat &&
        cam.lon === DEFAULT_CAMERA.lon &&
        cam.altKm === DEFAULT_CAMERA.altKm;
      if (fresh) state.setCameraSnapshot({ ...initialCamera, heading: 0, pitch: 0 });
    }
    if (timeRate !== undefined && timeRate !== 1) created.time.setRate(timeRate);
    return created;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engineProp]);

  if (!mounted) {
    return <div className={className} style={{ background: '#020617', ...style }} />;
  }

  return (
    <EarthEngineProvider engine={engine}>
      <div className={className} style={{ position: 'relative', ...style }}>
        <EarthCanvas engine={engine} textures={textures} stars={stars} moon={moon} />
        {children}
      </div>
    </EarthEngineProvider>
  );
}
