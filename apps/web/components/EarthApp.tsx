'use client';

import { useEffect, useMemo, useState } from 'react';
import { createEarthEngine, type EarthOSPlugin } from '@earthos/core';
import { EarthEngineProvider } from '@earthos/core/react';
import { createDefaultCache } from '@earthos/providers';
import { EarthCanvas } from '@earthos/globe';
import { CommandPalette, HoverCard, Inspector, LayerPanel, StatusBar, Timeline } from '@earthos/ui';
import { CaptureControls } from './CaptureControls';
import {
  applyPermalinkDynamics,
  isEmbed,
  readPermalink,
  startEmbedApi,
  startPermalinkSync,
} from './permalink';

import satellitesPlugin from '@earthos/plugin-satellites';
import imageryPlugin from '@earthos/plugin-imagery';
import eclipsePlugin from '@earthos/plugin-eclipse';
import hurricanesPlugin from '@earthos/plugin-hurricanes';
import aircraftPlugin from '@earthos/plugin-aircraft';
import earthquakesPlugin from '@earthos/plugin-earthquakes';
import daynightPlugin from '@earthos/plugin-daynight';
import geojsonPlugin from '@earthos/plugin-geojson';

/**
 * Plugin manifests are cheap by contract (no three, no provider code): the
 * heavy chunks load only when a layer is enabled. Adding a data source to
 * the app is exactly one line here.
 */
const PLUGINS: EarthOSPlugin[] = [
  imageryPlugin,
  satellitesPlugin,
  aircraftPlugin,
  daynightPlugin,
  eclipsePlugin,
  hurricanesPlugin,
  earthquakesPlugin,
  geojsonPlugin,
];

const TEXTURES_2K = {
  day: '/textures/earth_atmos_2048.jpg',
  night: '/textures/earth_lights_2048.png',
  specular: '/textures/earth_specular_2048.jpg',
  clouds: '/textures/earth_clouds_1024.png',
};

/** Optional 8k set (scripts/fetch-hd-textures.mjs): 16x sharper when zoomed. */
const TEXTURES_8K = {
  day: '/textures/full/8k_earth_daymap.jpg',
  night: '/textures/full/8k_earth_nightmap.jpg',
  specular: '/textures/earth_specular_2048.jpg',
  clouds: '/textures/full/8k_earth_clouds.jpg',
};

/** Layers switched on for first-time visitors. */
const DEFAULT_ENABLED = ['imagery', 'satellites', 'daynight'];

export function EarthApp() {
  const link = useMemo(() => readPermalink(), []);
  const embed = useMemo(() => isEmbed(), []);
  const engine = useMemo(() => {
    const created = createEarthEngine({ cache: createDefaultCache() });
    // Permalinked camera beats persisted state: shared links must reproduce.
    if (link.lat !== undefined && link.lon !== undefined) {
      created.store.getState().setCameraSnapshot({
        lat: link.lat,
        lon: link.lon,
        altKm: link.altKm ?? 12_000,
        heading: 0,
        pitch: 0,
      });
    }
    return created;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [ready, setReady] = useState(false);
  const [textures, setTextures] = useState(TEXTURES_2K);

  // Upgrade to the 8k set when the deployment fetched it.
  useEffect(() => {
    let cancelled = false;
    void fetch(TEXTURES_8K.day, { method: 'HEAD' })
      .then((res) => {
        if (!cancelled && res.ok) setTextures(TEXTURES_8K);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  // Developer mode hook: dev builds always, production only behind ?dev.
  useEffect(() => {
    const wanted =
      process.env.NODE_ENV !== 'production' ||
      new URLSearchParams(window.location.search).has('dev');
    if (wanted) (window as unknown as { __earthos?: unknown }).__earthos = engine;
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
      // OpenSky's CORS only allows its own origin: browsers must proxy.
      const airSettings = engine.getContext('aircraft')?.settings;
      if (airSettings && !(airSettings.get() as { endpoint?: string }).endpoint) {
        airSettings.patch({ endpoint: '/api/proxy/opensky' });
      }
      const nhcSettings = engine.getContext('hurricanes')?.settings;
      if (nhcSettings && !(nhcSettings.get() as { endpoint?: string }).endpoint) {
        nhcSettings.patch({ endpoint: '/api/proxy/nhc' });
      }
      if (cancelled) return;
      setReady(true);
      const prefs = engine.store.getState().layerPrefs;
      for (const plugin of PLUGINS) {
        // Permalink beats preference beats shipped default.
        const pref = prefs[plugin.id];
        const wanted = link.layers
          ? link.layers.includes(plugin.id)
          : pref
            ? pref.visible
            : DEFAULT_ENABLED.includes(plugin.id);
        if (wanted) void engine.activate(plugin.id).catch(() => undefined);
      }
      applyPermalinkDynamics(engine, link);
    })();
    // No engine.destroy() here: the engine lives for the page's lifetime, and
    // destroying in cleanup races StrictMode's remount against activation.
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine]);

  // Keep the URL shareable; embeds also listen for parent commands.
  useEffect(() => {
    const stopSync = startPermalinkSync(engine);
    const stopEmbed = embed ? startEmbedApi(engine) : undefined;
    return () => {
      stopSync();
      stopEmbed?.();
    };
  }, [engine, embed]);

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
        <EarthCanvas
          engine={engine}
          textures={textures}
          idleCinematicAfterS={embed ? 10 : 30}
          className="absolute inset-0"
        />

        {/* HUD overlay: pointer events pass through except on panels. */}
        <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-4">
          {embed ? (
            <div className="flex items-start justify-between">
              <span className="font-[family-name:var(--font-display)] text-[14px] text-[var(--text-secondary)]" style={{ fontWeight: 680 }}>
                Earth<span className="text-[var(--brand-400)]">OS</span>
              </span>
              <span className="text-[10px] text-[var(--text-muted)]">
                Esri / CelesTrak / OpenSky / USGS / NASA
              </span>
            </div>
          ) : null}
          {!embed ? (
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
          ) : null}

          {!embed ? (
          <div className="flex items-end justify-between gap-4">
            <div className="flex items-end gap-3">
              <StatusBar attribution="CelesTrak / OpenSky / USGS / NASA imagery" />
              <CaptureControls />
            </div>
            <Timeline />
          </div>
          ) : null}
        </div>

        {!embed ? <CommandPalette /> : null}
        <HoverCard />
      </div>
    </EarthEngineProvider>
  );
}
