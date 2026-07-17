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

/**
 * Transform a point from an object's local frame to world coordinates using
 * its matrixWorld (rigid transforms only). Earth-fixed layers use this in
 * their trackers so the follow camera and selection marker get world space.
 */
export function localPointToWorld(
  object: { matrixWorld: { elements: ArrayLike<number> } },
  x: number,
  y: number,
  z: number,
  out: [number, number, number],
): [number, number, number] {
  const e = object.matrixWorld.elements;
  out[0] = e[0]! * x + e[4]! * y + e[8]! * z + e[12]!;
  out[1] = e[1]! * x + e[5]! * y + e[9]! * z + e[13]!;
  out[2] = e[2]! * x + e[6]! * y + e[10]! * z + e[14]!;
  return out;
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
