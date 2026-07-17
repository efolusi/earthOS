'use client';

import { useEffect, useState } from 'react';
import type { PluginLoader } from '@earthos/core';
import { useEarth } from '@earthos/core/react';

export interface LayerProps {
  /** Lazy plugin manifest: `() => import('@earthos/plugin-satellites')`. */
  manifest: PluginLoader;
  enabled?: boolean;
  /** Initial/controlled settings patch, validated by the plugin's schema. */
  settings?: Record<string, unknown>;
}

/**
 * Declarative layer controller (renders nothing itself). Mount = register +
 * activate, unmount/toggle = deactivate, settings props patch live. Works
 * for third-party plugins with no wrapper needed.
 */
export function Layer({ manifest, enabled = true, settings }: LayerProps) {
  const engine = useEarth();
  const [id, setId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void engine.ensure(manifest).then((pluginId) => {
      if (!cancelled) setId(pluginId);
    });
    return () => {
      cancelled = true;
    };
  }, [engine, manifest]);

  const settingsKey = settings ? JSON.stringify(settings) : null;
  useEffect(() => {
    if (!id || !settingsKey) return;
    engine.getContext(id)?.settings.patch(JSON.parse(settingsKey) as Record<string, unknown>);
  }, [engine, id, settingsKey]);

  useEffect(() => {
    if (!id || !enabled) return;
    void engine.activate(id).catch(() => undefined);
    return () => {
      void engine.deactivate(id).catch(() => undefined);
    };
  }, [engine, id, enabled]);

  return null;
}
