'use client';

import { useEffect, useRef, useState } from 'react';
import { useEarthState } from '@earthos/core/react';

function useFps(): number {
  const [fps, setFps] = useState(0);
  const frames = useRef(0);
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const tick = () => {
      frames.current += 1;
      const now = performance.now();
      if (now - last >= 1000) {
        setFps(Math.round((frames.current * 1000) / (now - last)));
        frames.current = 0;
        last = now;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  return fps;
}

function formatCoord(value: number, positive: string, negative: string): string {
  const hemi = value >= 0 ? positive : negative;
  return `${Math.abs(value).toFixed(2)}°${hemi}`;
}

/** Camera readout + FPS: mono numerals on a Meridian pill. */
export function StatusBar({ attribution }: { attribution?: string }) {
  const camera = useEarthState((s) => s.camera);
  const fps = useFps();

  return (
    <div className="pointer-events-auto flex items-center gap-4 rounded-[var(--radius-full)] border border-[var(--border-default)] bg-[color-mix(in_srgb,var(--surface-card)_94%,transparent)] px-4 py-1.5 font-[family-name:var(--font-mono)] text-[12px] text-[var(--text-secondary)] shadow-[var(--shadow-md)] backdrop-blur-xl">
      <span data-testid="camera-readout">
        {formatCoord(camera.lat, 'N', 'S')} {formatCoord(camera.lon, 'E', 'W')}
      </span>
      <span>alt {Math.round(camera.altKm).toLocaleString()} km</span>
      <span
        className={
          fps >= 50
            ? 'text-[var(--success-600)]'
            : fps >= 25
              ? 'text-[var(--warning-600)]'
              : 'text-[var(--danger-600)]'
        }
        data-testid="fps"
      >
        {fps} fps
      </span>
      {attribution ? (
        <span className="font-[family-name:var(--font-sans)] text-[var(--text-muted)]">
          {attribution}
        </span>
      ) : null}
    </div>
  );
}
