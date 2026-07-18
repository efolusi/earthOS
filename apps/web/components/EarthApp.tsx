'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createEarthEngine, type EarthOSPlugin } from '@earthos/core';
import { EarthEngineProvider } from '@earthos/core/react';
import { createDefaultCache } from '@earthos/providers';
import { EarthCanvas } from '@earthos/globe';
import { CommandPalette, HoverCard, Inspector, LayerPanel, StatusBar, Timeline } from '@earthos/ui';
import { MeasureLayer, type MeasurePoint } from './MeasureLayer';
import { ActionBar } from './ActionBar';
import { MyLocationPanel, type Observer } from './MyLocationPanel';
import { MyLocationLayer } from './MyLocationLayer';
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
import wildfiresPlugin from '@earthos/plugin-wildfires';
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
  wildfiresPlugin,
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

  // Measurement tool: great-circle path + spherical area, click-to-add.
  const [measureActive, setMeasureActive] = useState(false);
  const [measurePoints, setMeasurePoints] = useState<MeasurePoint[]>([]);
  const addMeasurePoint = useCallback(
    (lat: number, lon: number) => setMeasurePoints((p) => [...p, { lat, lon }]),
    [],
  );

  // My Location: what satellites are above the viewer right now.
  const [observer, setObserver] = useState<Observer | null>(null);
  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState<string | null>(null);
  const locateMe = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setLocateError('Geolocation is not available in this browser.');
      return;
    }
    setLocating(true);
    setLocateError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        const next = { lat: pos.coords.latitude, lon: pos.coords.longitude };
        setObserver(next);
        void engine.setLayerEnabled('satellites', true).catch(() => undefined);
        engine.events.emit('core:camera:flyTo', { lat: next.lat, lon: next.lon, altKm: 4_000 });
      },
      (err) => {
        setLocating(false);
        setLocateError(err.code === err.PERMISSION_DENIED ? 'Location permission denied.' : 'Could not get your location.');
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 60_000 },
    );
  }, [engine]);

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
      // CelesTrak + airplanes.live serve CORS * and block cloud egress IPs,
      // so browsers fetch them directly. Older builds patched Worker-proxy
      // endpoints into persisted settings; clear those or returning visitors
      // stay pinned to the dead proxies.
      const satSettings = engine.getContext('satellites')?.settings;
      if ((satSettings?.get() as { endpoint?: string })?.endpoint === '/api/proxy/celestrak') {
        satSettings?.patch({ endpoint: '' });
      }
      const airSettings = engine.getContext('aircraft')?.settings;
      if ((airSettings?.get() as { endpoint?: string })?.endpoint === '/api/proxy/opensky') {
        airSettings?.patch({ endpoint: '' });
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
        >
          {!embed ? (
            <MeasureLayer
              active={measureActive}
              points={measurePoints}
              onAddPoint={addMeasurePoint}
            />
          ) : null}
          {!embed ? <MyLocationLayer observer={observer} /> : null}
        </EarthCanvas>

        {/* HUD overlay: pointer events pass through except on panels. */}
        <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-2 sm:p-4">
          {embed ? (
            <div className="flex items-start justify-between">
              <span
                className="font-[family-name:var(--font-display)] text-[14px] text-[var(--text-secondary)]"
                style={{ fontWeight: 680 }}
              >
                Earth<span className="text-[var(--brand-400)]">OS</span>
              </span>
              <span className="text-[10px] text-[var(--text-muted)]">
                Esri / CelesTrak / airplanes.live / USGS / NASA
              </span>
            </div>
          ) : null}
          {!embed ? (
            <div className="flex items-start justify-between gap-2 sm:gap-4">
              <div className="flex min-w-0 flex-col items-start gap-2">
                <header className="pointer-events-auto select-none">
                  <h1
                    className="font-[family-name:var(--font-display)] text-[17px] tracking-[var(--tracking-display)] text-[var(--text-primary)] sm:text-[21px]"
                    style={{ fontWeight: 680 }}
                  >
                    Earth<span className="text-[var(--brand-400)]">OS</span>
                  </h1>
                  <p className="hidden text-[12px] text-[var(--text-muted)] sm:block">
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
                <MyLocationPanel
                  observer={observer}
                  locating={locating}
                  error={locateError}
                  onLocate={locateMe}
                  onClear={() => setObserver(null)}
                />
              </div>
              <div className="flex flex-col items-end gap-3">
                {ready ? <LayerPanel plugins={PLUGINS} /> : null}
                <Inspector />
              </div>
            </div>
          ) : null}

          {!embed ? (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
              <div className="order-2 flex items-center gap-2 sm:order-1">
                <div className="hidden sm:block">
                  <StatusBar />
                </div>
                <ActionBar
                  measureActive={measureActive}
                  measurePoints={measurePoints}
                  onMeasureToggle={() => setMeasureActive((a) => !a)}
                  onMeasureUndo={() => setMeasurePoints((p) => p.slice(0, -1))}
                  onMeasureClear={() => setMeasurePoints([])}
                />
              </div>
              <div className="order-1 max-w-full overflow-x-auto sm:order-2">
                <Timeline />
              </div>
            </div>
          ) : null}
        </div>

        {!embed ? <CommandPalette /> : null}
        <HoverCard />
      </div>
    </EarthEngineProvider>
  );
}
