'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useFrame } from '@react-three/fiber';
import { Group } from 'three';
import { useEarth } from '@earthos/core/react';
import { gmstRad } from '@earthos/gis';

const EarthFixedContext = createContext<Group | null>(null);

/**
 * Provides THE rotating Earth-fixed frame: one Group whose Y rotation is
 * GMST. Children render in the normal (inertial) tree; anything that must
 * rotate with the ground portals into the group:
 *
 *   const earthFixed = useEarthFixed();
 *   return earthFixed ? createPortal(<mesh .../>, earthFixed) : null;
 *
 * Content portalled in is authored in swizzled-ECEF local coordinates (see
 * @earthos/gis geodeticToScene) and lands correctly in world space at zero
 * per-object cost. This provider wraps the whole canvas subtree, so plugin
 * renderers mounted by PluginLayersHost can reach it.
 */
export function EarthFixedGroup({ children }: { children?: ReactNode }) {
  const engine = useEarth();
  const group = useMemo(() => new Group(), []);

  useFrame(() => {
    group.rotation.y = gmstRad(engine.time.now());
  });

  return (
    <>
      <primitive object={group} />
      <EarthFixedContext.Provider value={group}>{children}</EarthFixedContext.Provider>
    </>
  );
}

/** The Earth-fixed group instance (portal target). */
export function useEarthFixed(): Group | null {
  return useContext(EarthFixedContext);
}
