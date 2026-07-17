'use client';

import { useEffect, useMemo, useState } from 'react';
import { createEarthEngine, type EarthOSPlugin } from '@earthos/core';
import { EarthEngineProvider } from '@earthos/core/react';
import { createDefaultCache } from '@earthos/providers';
import { EarthCanvas } from '@earthos/globe';
import { CommandPalette, Inspector, LayerPanel, StatusBar, Timeline } from '@earthos/ui';

import satellitesPlugin from '@earthos/plugin-satellites';
import earthquakesPlugin from '@earthos/plugin-earthquakes';
import daynightPlugin from '@earthos/plugin-daynight';
import geojsonPlugin from '@earthos/plugin-geojson';

/**
 * Plugin manifests are cheap by contract (no three, no provider code): the
 * heavy chunks load only when a layer is enabled. Adding a data source to
 * the app is exactly one line here.
 */
const PLUGINS: EarthOSPlugin[] = [
  satellitesPlugin,
  daynightPlugin,
  earthquakesPlugin,
  geojsonPlugin,
];

const TEXTURES = {
  day: '/textures/earth_atmos_2048.jpg',
  night: '/textures/earth_lights_2048.png',
  specular: '/textures/earth_specular_2048.jpg',
  clouds: '/textures/earth_clouds_1024.png',
};

/** Layers switched on for first-time visitors. */
const DEFAULT_ENABLED = ['satellites', 'daynight'];

export function EarthApp() {
  const engine = useMemo(() => createEarthEngine({ cache: createDefaultCache() }), []);
  const [ready, setReady] = useState(false);

  // Developer mode hook: inspect the engine from the console.
  useEffect(() => {
    (window as unknown as { __earthos?: unknown }).__earthos = engine;
  }, [engine]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      for (const plugin of PLUGINS) {
        await engine.register(plugin); // idempotent: StrictMode re-runs no-op
      }
      // App default: route CelesTrak through our proxy (server-side fetch,
      // one upstream hit per group per hour, immune to client bot-blocking).
      const satSettings = engine.getContext('satellites')?.settings;
      if (satSettings && !(satSettings.get() as { endpoint?: string }).endpoint) {
        satSettings.patch({ endpoint: '/api/proxy/celestrak' });
      }
      if (cancelled) return;
      setReady(true);
      const prefs = engine.store.getState().layerPrefs;
      const hasPrefs = Object.keys(prefs).length > 0;
      for (const plugin of PLUGINS) {
        const wanted = hasPrefs ? prefs[plugin.id]?.visible : DEFAULT_ENABLED.includes(plugin.id);
        if (wanted) void engine.activate(plugin.id).catch(() => undefined);
      }
    })();
    // No engine.destroy() here: the engine lives for the page's lifetime, and
    // destroying in cleanup races StrictMode's remount against activation.
    return () => {
      cancelled = true;
    };
  }, [engine]);

  // Global shortcuts (palette handles its own cmd+k).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
      if (e.code === 'Space') {
        e.preventDefault();
        const t = engine.time;
        if (!t.live && t.rate === 0) t.setRate(1);
        else t.pause();
      } else if (e.key.toLowerCase() === 'n') {
        engine.time.resumeLive();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [engine]);

  return (
    <EarthEngineProvider engine={engine}>
      <div className="relative h-screen w-screen overflow-hidden">
        <EarthCanvas engine={engine} textures={TEXTURES} className="absolute inset-0" />

        {/* HUD overlay: pointer events pass through except on panels. */}
        <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-4">
          <div className="flex items-start justify-between gap-4">
            <header className="pointer-events-auto select-none">
              <h1
                className="font-[family-name:var(--font-display)] text-[21px] tracking-[var(--tracking-display)] text-[var(--text-primary)]"
                style={{ fontWeight: 680 }}
              >
                Earth<span className="text-[var(--brand-400)]">OS</span>
              </h1>
              <p className="text-[12px] text-[var(--text-muted)]">
                Press{' '}
                <kbd className="rounded-[var(--radius-sm)] border border-[var(--border-default)] bg-[var(--surface-sunken)] px-1 font-[family-name:var(--font-mono)] text-[11px]">
                  ⌘K
                </kbd>{' '}
                to search,{' '}
                <kbd className="rounded-[var(--radius-sm)] border border-[var(--border-default)] bg-[var(--surface-sunken)] px-1 font-[family-name:var(--font-mono)] text-[11px]">
                  space
                </kbd>{' '}
                to pause time
              </p>
            </header>
            <div className="flex flex-col items-end gap-3">
              {ready ? <LayerPanel plugins={PLUGINS} /> : null}
              <Inspector />
            </div>
          </div>

          <div className="flex items-end justify-between gap-4">
            <StatusBar attribution="CelesTrak / USGS / NASA imagery" />
            <Timeline />
          </div>
        </div>

        <CommandPalette />
      </div>
    </EarthEngineProvider>
  );
}
