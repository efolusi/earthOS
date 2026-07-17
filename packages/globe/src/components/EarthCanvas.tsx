'use client';

import { useEffect, useMemo, type ReactNode } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { createEarthEngine, type EarthEngine } from '@earthos/core';
import { EarthEngineProvider } from '@earthos/core/react';
import { CAMERA_FAR, DEFAULT_FOV_DEG } from '../constants';
import type { GlobeTextureUrls } from '../textures';
import { trackersOf } from '../trackers';
import { EarthFixedGroup } from './EarthFixedGroup';
import { GlobeScene } from './GlobeScene';
import { GlobeCamera } from './GlobeCamera';
import { PluginLayersHost } from './PluginLayersHost';

function EngineBridges({ engine }: { engine: EarthEngine }) {
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    engine.setInvalidate(invalidate);
    return () => engine.setInvalidate(null);
  }, [engine, invalidate]);
  return null;
}

export interface EarthCanvasProps {
  /** Bring your own engine (SDK <Earth/> does); defaults to a fresh one. */
  engine?: EarthEngine;
  textures?: GlobeTextureUrls;
  stars?: boolean;
  moon?: boolean;
  children?: ReactNode;
  className?: string;
}

/**
 * The assembled globe: Canvas + scene + camera + plugin layer host, wired to
 * one EarthEngine. This component must only render client-side (the SDK
 * wraps it in next/dynamic with ssr disabled).
 */
export function EarthCanvas({
  engine: engineProp,
  textures,
  stars,
  moon,
  children,
  className,
}: EarthCanvasProps) {
  const engine = useMemo(() => engineProp ?? createEarthEngine(), [engineProp]);

  // The follow-camera tracker registry must exist before any renderer mounts.
  useMemo(() => trackersOf(engine), [engine]);

  return (
    <EarthEngineProvider engine={engine}>
      <Canvas
        className={className}
        frameloop="always"
        dpr={[1, 2]}
        camera={{ fov: DEFAULT_FOV_DEG, near: 50, far: CAMERA_FAR, position: [30_000, 12_000, 0] }}
        gl={{ antialias: true, powerPreference: 'high-performance', logarithmicDepthBuffer: false }}
      >
        <EngineBridges engine={engine} />
        <EarthFixedGroup>
          <GlobeScene textures={textures} stars={stars} moon={moon} />
          <GlobeCamera />
          <PluginLayersHost />
          {children}
        </EarthFixedGroup>
      </Canvas>
    </EarthEngineProvider>
  );
}
