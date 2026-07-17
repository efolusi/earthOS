'use client';

import { createContext, useContext, useRef, useState, type ReactNode } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group } from 'three';
import { useEarth } from '@earthos/core/react';
import { gmstRad } from '@earthos/gis';

const EarthFixedContext = createContext<Group | null>(null);

/**
 * The single group every Earth-fixed thing lives under. Its Y rotation is
 * GMST, so children authored in swizzled-ECEF local coordinates (see
 * @earthos/gis geodeticToScene) end up correctly placed in the inertial
 * world frame at zero per-object cost.
 */
export function EarthFixedGroup({ children }: { children?: ReactNode }) {
  const engine = useEarth();
  const ref = useRef<Group | null>(null);
  const [group, setGroup] = useState<Group | null>(null);

  useFrame(() => {
    if (ref.current) ref.current.rotation.y = gmstRad(engine.time.now());
  });

  return (
    <group
      ref={(g) => {
        ref.current = g;
        setGroup(g);
      }}
    >
      <EarthFixedContext.Provider value={group}>{children}</EarthFixedContext.Provider>
    </group>
  );
}

/**
 * The Earth-fixed group instance, for plugin renderers that need to portal
 * meshes into the rotating frame:
 *
 *   const earthFixed = useEarthFixed();
 *   return earthFixed ? createPortal(<mesh .../>, earthFixed) : null;
 */
export function useEarthFixed(): Group | null {
  return useContext(EarthFixedContext);
}
