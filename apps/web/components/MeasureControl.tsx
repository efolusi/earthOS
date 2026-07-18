'use client';

import { useMemo } from 'react';
import { GlassPanel, IconButton } from '@earthos/ui';
import { pathLengthKm, sphericalPolygonAreaKm2 } from '@earthos/gis';
import type { MeasurePoint } from './MeasureLayer';

function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  if (km < 100) return `${km.toFixed(1)} km`;
  return `${Math.round(km).toLocaleString()} km`;
}

function formatArea(km2: number): string {
  if (km2 < 1) return `${Math.round(km2 * 1e6).toLocaleString()} m²`;
  return `${Math.round(km2).toLocaleString()} km²`;
}

/** Measure toggle + live distance/area readout for the current path. */
export function MeasureControl({
  active,
  points,
  onToggle,
  onUndo,
  onClear,
}: {
  active: boolean;
  points: MeasurePoint[];
  onToggle: () => void;
  onUndo: () => void;
  onClear: () => void;
}) {
  const latlon = useMemo(
    () => points.map((p) => [p.lat, p.lon] as [number, number]),
    [points],
  );
  const distance = useMemo(() => pathLengthKm(latlon), [latlon]);
  const area = useMemo(() => (latlon.length >= 3 ? sphericalPolygonAreaKm2(latlon) : 0), [latlon]);

  return (
    <GlassPanel className="px-2 py-1.5">
      <div className="flex items-center gap-2">
        <IconButton label={active ? 'Stop measuring' : 'Measure distance and area'} onClick={onToggle} active={active}>
          <span className="flex items-center gap-1.5">
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden>
              <path d="M1 9.5L9.5 1l3.5 3.5L4.5 13z" />
              <path d="M4 6.5l1.2 1.2M6.2 4.3l1.2 1.2M8.4 2.1l1.2 1.2" />
            </svg>
            Measure
          </span>
        </IconButton>

        {active ? (
          <>
            <div className="mx-0.5 h-5 w-px bg-[var(--border-default)]" />
            <div className="min-w-[7rem] px-1 font-[family-name:var(--font-mono)] text-[12px] leading-tight text-[var(--text-primary)]">
              {points.length < 2 ? (
                <span className="text-[var(--text-muted)]">tap the globe</span>
              ) : (
                <>
                  <div>{formatDistance(distance)}</div>
                  {area > 0 ? (
                    <div className="text-[var(--text-secondary)]">{formatArea(area)}</div>
                  ) : null}
                </>
              )}
            </div>
            <IconButton label="Undo last point" onClick={onUndo}>
              <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden>
                <path d="M4 4H9a3.5 3.5 0 010 7H5M4 4l2.2-2.2M4 4l2.2 2.2" />
              </svg>
            </IconButton>
            <IconButton label="Clear measurement" onClick={onClear}>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
                <path d="M2 2l8 8M10 2l-8 8" />
              </svg>
            </IconButton>
          </>
        ) : null}
      </div>
    </GlassPanel>
  );
}
