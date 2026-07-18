'use client';

import { useMemo, useRef, useState } from 'react';
import { useEarth } from '@earthos/core/react';
import { GlassPanel, IconButton } from '@earthos/ui';
import { pathLengthKm, sphericalPolygonAreaKm2 } from '@earthos/gis';
import { buildPermalink } from './permalink';
import type { MeasurePoint } from './MeasureLayer';

const ATTRIBUTION =
  'EarthOS · open-source digital twin · imagery: Esri/NASA · data: CelesTrak/airplanes.live/USGS';

function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  if (km < 100) return `${km.toFixed(1)} km`;
  return `${Math.round(km).toLocaleString()} km`;
}
function formatArea(km2: number): string {
  if (km2 < 1) return `${Math.round(km2 * 1e6).toLocaleString()} m²`;
  return `${Math.round(km2).toLocaleString()} km²`;
}

/**
 * One consolidated icon bar: copy-link, screenshot, record clip, measure.
 * Every viewer is a publisher; measurement lives here too so the footer stays
 * a single consistent-height pill.
 */
export function ActionBar({
  measureActive,
  measurePoints,
  onMeasureToggle,
  onMeasureUndo,
  onMeasureClear,
}: {
  measureActive: boolean;
  measurePoints: MeasurePoint[];
  onMeasureToggle: () => void;
  onMeasureUndo: () => void;
  onMeasureClear: () => void;
}) {
  const engine = useEarth();
  const [recording, setRecording] = useState(false);
  const [copied, setCopied] = useState(false);
  const recorder = useRef<MediaRecorder | null>(null);

  const canvas = () => engine.getExtension<HTMLCanvasElement>('globe:canvas');

  const screenshot = () => {
    const source = canvas();
    if (!source) return;
    const out = document.createElement('canvas');
    out.width = source.width;
    out.height = source.height + 44;
    const ctx = out.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#191512';
    ctx.fillRect(0, 0, out.width, out.height);
    ctx.drawImage(source, 0, 0);
    ctx.fillStyle = '#9c9280';
    ctx.font = '20px JetBrains Mono, monospace';
    ctx.fillText(ATTRIBUTION, 16, out.height - 15);
    out.toBlob((blob) => {
      if (!blob) return;
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `earthos-${Date.now()}.png`;
      a.click();
      URL.revokeObjectURL(a.href);
    }, 'image/png');
  };

  const toggleRecord = () => {
    if (recorder.current) {
      recorder.current.stop();
      recorder.current = null;
      setRecording(false);
      return;
    }
    const source = canvas();
    if (!source) return;
    const stream = source.captureStream(30);
    const rec = new MediaRecorder(stream, { mimeType: 'video/webm' });
    const chunks: Blob[] = [];
    rec.ondataavailable = (e) => e.data.size > 0 && chunks.push(e.data);
    rec.onstop = () => {
      const blob = new Blob(chunks, { type: 'video/webm' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `earthos-${Date.now()}.webm`;
      a.click();
      URL.revokeObjectURL(a.href);
      stream.getTracks().forEach((t) => t.stop());
    };
    rec.start();
    recorder.current = rec;
    setRecording(true);
  };

  const copyLink = () => {
    const url = `${window.location.origin}${window.location.pathname}${buildPermalink(engine)}`;
    void navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  const latlon = useMemo(() => measurePoints.map((p) => [p.lat, p.lon] as [number, number]), [measurePoints]);
  const distance = useMemo(() => pathLengthKm(latlon), [latlon]);
  const area = useMemo(() => (latlon.length >= 3 ? sphericalPolygonAreaKm2(latlon) : 0), [latlon]);

  return (
    <GlassPanel className="flex h-10 items-center px-1.5">
      <div className="flex items-center gap-0.5">
        <IconButton label={copied ? 'Link copied' : 'Copy share link'} onClick={copyLink} active={copied}>
          {copied ? (
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
              <path d="M2.5 7.5l3 3 6-7" />
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden>
              <path d="M5.5 8.5a2.5 2.5 0 003.5 0l2-2a2.5 2.5 0 00-3.5-3.5l-1 1" />
              <path d="M8.5 5.5a2.5 2.5 0 00-3.5 0l-2 2a2.5 2.5 0 003.5 3.5l1-1" />
            </svg>
          )}
        </IconButton>
        <IconButton label="Save screenshot" onClick={screenshot}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden>
            <rect x="1" y="3.5" width="12" height="9" rx="1.5" />
            <circle cx="7" cy="8" r="2.6" />
            <path d="M4.5 3.5L5.6 1.5h2.8l1.1 2" />
          </svg>
        </IconButton>
        <IconButton
          label={recording ? 'Stop recording' : 'Record clip'}
          onClick={toggleRecord}
          active={recording}
        >
          <span
            className={`inline-block h-2.5 w-2.5 rounded-full ${recording ? 'animate-pulse bg-[var(--danger-600)]' : 'bg-[var(--text-secondary)]'}`}
          />
        </IconButton>

        <div className="mx-0.5 h-5 w-px bg-[var(--border-default)]" />

        <IconButton
          label={measureActive ? 'Stop measuring' : 'Measure distance and area'}
          onClick={onMeasureToggle}
          active={measureActive}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden>
            <path d="M1 9.5L9.5 1l3.5 3.5L4.5 13z" />
            <path d="M4 6.5l1.2 1.2M6.2 4.3l1.2 1.2M8.4 2.1l1.2 1.2" />
          </svg>
        </IconButton>

        {measureActive ? (
          <>
            <span className="px-1 font-[family-name:var(--font-mono)] text-[11px] text-[var(--text-primary)]">
              {measurePoints.length < 2 ? (
                <span className="text-[var(--text-muted)]">tap the globe</span>
              ) : (
                <>
                  {formatDistance(distance)}
                  {area > 0 ? <span className="text-[var(--text-secondary)]"> · {formatArea(area)}</span> : null}
                </>
              )}
            </span>
            <IconButton label="Undo last point" onClick={onMeasureUndo}>
              <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden>
                <path d="M4 4H9a3.5 3.5 0 010 7H5M4 4l2.2-2.2M4 4l2.2 2.2" />
              </svg>
            </IconButton>
            <IconButton label="Clear measurement" onClick={onMeasureClear}>
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
