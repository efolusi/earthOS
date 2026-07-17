import type { EarthEngine, PluginContext } from '@earthos/core';

/**
 * Per-frame entity position resolution, used by the follow camera. Plugins
 * that render moving entities register a tracker so the camera (and future
 * analytics) can ask "where is entity X right now" in world scene
 * coordinates without async round trips.
 *
 * Exposed through the extension hatch (apiVersion 1): graduates to a named
 * PluginContext member if apiVersion 2 ever lands.
 */
export type EntityTracker = (
  entityId: string,
  epochMs: number,
  out: [number, number, number],
) => boolean;

export const TRACKERS_EXTENSION = 'globe:trackers';

/** The engine-wide tracker registry (layerId -> tracker), created on demand. */
export function trackersOf(engine: EarthEngine): Map<string, EntityTracker> {
  const existing = engine.getExtension<Map<string, EntityTracker>>(TRACKERS_EXTENSION);
  if (existing) return existing;
  const created = new Map<string, EntityTracker>();
  engine.provideExtension(TRACKERS_EXTENSION, created);
  return created;
}

/** Plugin-side helper: register this layer's tracker; returns a disposer. */
export function registerTracker(ctx: PluginContext, tracker: EntityTracker): () => void {
  const map = ctx.getExtension<Map<string, EntityTracker>>(TRACKERS_EXTENSION);
  if (!map) return () => undefined;
  map.set(ctx.pluginId, tracker);
  return () => {
    if (map.get(ctx.pluginId) === tracker) map.delete(ctx.pluginId);
  };
}
