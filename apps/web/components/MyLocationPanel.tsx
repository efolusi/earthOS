'use client';

import { useEffect, useRef, useState } from 'react';
import { useEarth } from '@earthos/core/react';
import { GlassPanel, IconButton } from '@earthos/ui';
import { geodeticToEcef, observerLookAngles, parseOmm, parseTle, satGeodetic, type SatRec } from '@earthos/gis';

export interface Observer {
  lat: number;
  lon: number;
}

interface Overhead {
  name: string;
  norad: string;
  elDeg: number;
  azDeg: number;
  rangeKm: number;
}

const isTle = (r: { TLE_LINE1?: unknown; TLE_LINE2?: unknown }) =>
  typeof r.TLE_LINE1 === 'string' && typeof r.TLE_LINE2 === 'string';

function compass(azDeg: number): string {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return dirs[Math.round(azDeg / 45) % 8]!;
}

/**
 * "What's above me": request the viewer's location, then list the satellites
 * currently over the local horizon, highest first, with elevation/direction/
 * range — the go-outside-and-look-up view (à la satellitemap.space).
 */
export function MyLocationPanel({
  observer,
  locating,
  error,
  onLocate,
  onClear,
}: {
  observer: Observer | null;
  locating: boolean;
  error: string | null;
  onLocate: () => void;
  onClear: () => void;
}) {
  const engine = useEarth();
  const satrecCache = useRef(new Map<string, SatRec | null>());
  const [overhead, setOverhead] = useState<Overhead[]>([]);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    if (!observer) {
      setOverhead([]);
      setTotal(0);
      return;
    }
    const compute = () => {
      const records = engine.getContext('satellites')?.providers.handle('celestrak-gp')?.get()
        ?.data as Array<Record<string, unknown>> | undefined;
      if (!Array.isArray(records) || records.length === 0) {
        setOverhead([]);
        setTotal(0);
        return;
      }
      const now = engine.time.now();
      const above: Overhead[] = [];
      const seen = new Set<string>();
      for (const r of records) {
        const norad = String(r.NORAD_CAT_ID);
        if (seen.has(norad)) continue; // the popularity catalog can carry dupes
        seen.add(norad);
        let satrec = satrecCache.current.get(norad);
        if (satrec === undefined) {
          try {
            satrec = isTle(r)
              ? parseTle(r.TLE_LINE1 as string, r.TLE_LINE2 as string)
              : parseOmm(r as never);
          } catch {
            satrec = null;
          }
          satrecCache.current.set(norad, satrec);
        }
        if (!satrec) continue;
        const geo = satGeodetic(satrec, now);
        // Drop SGP4 blowups on decayed/bad element sets (garbage altitudes).
        if (!geo || !Number.isFinite(geo.altKm) || geo.altKm < -50 || geo.altKm > 60_000) continue;
        const e = geodeticToEcef(geo.latDeg, geo.lonDeg, geo.altKm);
        const la = observerLookAngles(observer.lat, observer.lon, 0, e[0], e[1], e[2]);
        // Above the horizon and within a plausible slant range (GEO ≈ 42,000 km).
        if (la.elDeg > 0 && la.rangeKm < 45_000) {
          above.push({ name: (r.OBJECT_NAME as string) ?? norad, norad, ...la });
        }
      }
      above.sort((a, b) => b.elDeg - a.elDeg);
      setTotal(above.length);
      setOverhead(above.slice(0, 12));
    };
    compute();
    const t = setInterval(compute, 3000);
    return () => clearInterval(t);
  }, [observer, engine]);

  return (
    <div className="pointer-events-auto flex flex-col items-start gap-2">
      <IconButton
        label={observer ? 'Update my location' : 'Use my location'}
        onClick={onLocate}
        active={!!observer}
        className="border border-[var(--border-default)] bg-[color-mix(in_srgb,var(--surface-card)_94%,transparent)] px-2.5 shadow-[var(--shadow-md)] backdrop-blur-xl"
      >
        <span className="flex items-center gap-1.5 whitespace-nowrap">
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden>
            <circle cx="7" cy="7" r="2.4" />
            <path d="M7 1v1.6M7 11.4V13M1 7h1.6M11.4 7H13" />
          </svg>
          {locating ? 'Locating…' : "What's above me"}
        </span>
      </IconButton>

      {error ? (
        <GlassPanel className="max-w-[16rem] px-3 py-2">
          <p className="text-[12px] text-[var(--danger-600)]">{error}</p>
        </GlassPanel>
      ) : null}

      {observer ? (
        <GlassPanel className="w-[min(19rem,calc(100vw-1rem))]" title="Above you" actions={
          <IconButton label="Clear my location" onClick={onClear}>
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
              <path d="M2 2l8 8M10 2l-8 8" />
            </svg>
          </IconButton>
        }>
          <div className="px-3.5 pb-2 pt-1 text-[11px] text-[var(--text-muted)]">
            {observer.lat.toFixed(3)}°, {observer.lon.toFixed(3)}° · {total} satellite{total === 1 ? '' : 's'} overhead
          </div>
          {overhead.length === 0 ? (
            <p className="px-3.5 pb-3 text-[12px] text-[var(--text-muted)]">
              Enable the Satellites layer to see what&apos;s passing over you.
            </p>
          ) : (
            <ul className="max-h-[32vh] overflow-y-auto pb-1">
              {overhead.map((s) => (
                <li key={s.norad}>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-2 px-3.5 py-1.5 text-left hover:bg-[var(--surface-sunken)]"
                    onClick={() =>
                      engine.store.getState().setSelected({ layerId: 'satellites', entityId: s.norad })
                    }
                  >
                    <span className="truncate text-[12px] text-[var(--text-primary)]">{s.name}</span>
                    <span className="shrink-0 font-[family-name:var(--font-mono)] text-[11px] text-[var(--text-secondary)]">
                      {Math.round(s.elDeg)}° {compass(s.azDeg)} · {Math.round(s.rangeKm).toLocaleString()} km
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </GlassPanel>
      ) : null}
    </div>
  );
}
