'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { useStore } from 'zustand';
// Self-referencing package import: keeps the react entry sharing ONE copy of
// the runtime and ONE set of type declarations with the root entry.
import type { EarthEngine, EarthState, LayerRenderer, PluginLoader, TimeSnapshot } from '@earthos/core';

const EarthContext = createContext<EarthEngine | null>(null);

export function EarthEngineProvider({
  engine,
  children,
}: {
  engine: EarthEngine;
  children: ReactNode;
}) {
  return <EarthContext.Provider value={engine}>{children}</EarthContext.Provider>;
}

/** The engine owning this React tree. Throws outside <EarthEngineProvider/>. */
export function useEarth(): EarthEngine {
  const engine = useContext(EarthContext);
  if (!engine) throw new Error('useEarth must be used inside <Earth/> (EarthEngineProvider)');
  return engine;
}

/** Subscribe to a slice of engine UI state. Never use for per-frame values. */
export function useEarthState<T>(selector: (state: EarthState) => T): T {
  const engine = useEarth();
  return useStore(engine.store, selector);
}

/** Low-frequency time snapshot (rate/live/epoch at change granularity). */
export function useSimTime(): TimeSnapshot {
  return useEarthState((s) => s.timeCtl);
}

/** Active layer renderers, for the host component inside the Canvas. */
export function useLayerRenderers(): Array<[string, LayerRenderer]> {
  const engine = useEarth();
  return useSyncExternalStore(
    (cb) => engine.onRenderersChange(cb),
    () => renderersSnapshot(engine),
    () => renderersSnapshot(engine),
  );
}

const snapshotCache = new WeakMap<EarthEngine, Array<[string, LayerRenderer]>>();
function renderersSnapshot(engine: EarthEngine): Array<[string, LayerRenderer]> {
  const cached = snapshotCache.get(engine);
  const current = [...engine.getRenderers().entries()];
  if (
    cached &&
    cached.length === current.length &&
    cached.every(([id, r], i) => current[i]?.[0] === id && current[i]?.[1] === r)
  ) {
    return cached;
  }
  snapshotCache.set(engine, current);
  return current;
}

export interface UseLayerResult {
  status: EarthState['layers'][string]['status'] | 'unregistered';
  visible: boolean;
  enable: () => void;
  disable: () => void;
}

/**
 * Declaratively bind one plugin to the React tree: registers on mount from a
 * lazy loader, activates when `enabled`, deactivates on unmount/toggle.
 */
export function useLayer(loader: PluginLoader, enabled = true): UseLayerResult {
  const engine = useEarth();
  const [id, setId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void engine.ensure(loader).then((pluginId) => {
      if (!cancelled) setId(pluginId);
    });
    return () => {
      cancelled = true;
    };
  }, [engine, loader]);

  useEffect(() => {
    if (!id) return;
    if (enabled) void engine.activate(id).catch(() => undefined);
    return () => {
      void engine.deactivate(id).catch(() => undefined);
    };
  }, [engine, id, enabled]);

  const layer = useEarthState((s) => (id ? s.layers[id] : undefined));
  return {
    status: layer?.status ?? 'unregistered',
    visible: layer?.visible ?? false,
    enable: () => {
      if (id) void engine.activate(id).catch(() => undefined);
    },
    disable: () => {
      if (id) void engine.deactivate(id).catch(() => undefined);
    },
  };
}
