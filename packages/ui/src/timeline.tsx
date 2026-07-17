'use client';

import { useEffect, useState } from 'react';
import { useEarth, useSimTime } from '@earthos/core/react';
import { GlassPanel, IconButton } from './panel';

const RATES = [1, 10, 100, 1000, 10000];

function formatUtc(epochMs: number): string {
  const d = new Date(epochMs);
  return `${d.toISOString().slice(0, 10)} ${d.toISOString().slice(11, 19)} UTC`;
}

/**
 * Time travel: play/pause, rate stepping, hour jumps, and live re-sync.
 * The readout polls the sim clock at 4 Hz; per-frame consumers never come
 * through React.
 */
export function Timeline() {
  const engine = useEarth();
  const timeCtl = useSimTime();
  const [nowMs, setNowMs] = useState(() => engine.time.now());

  useEffect(() => {
    const interval = setInterval(() => setNowMs(engine.time.now()), 250);
    return () => clearInterval(interval);
  }, [engine]);

  const paused = !timeCtl.live && timeCtl.rate === 0;
  const rateMagnitude = Math.abs(timeCtl.rate) || 1;
  const direction = timeCtl.rate < 0 ? -1 : 1;

  const cycleRate = (dir: 1 | -1) => {
    const idx = RATES.findIndex((r) => r >= rateMagnitude);
    const next = RATES[Math.min(Math.max((idx === -1 ? 0 : idx) + dir, 0), RATES.length - 1)]!;
    engine.time.setRate(next * direction);
  };

  return (
    <GlassPanel className="px-4 py-2.5">
      <div className="flex items-center gap-2">
        <IconButton label="Back 1 hour" onClick={() => engine.time.offsetBy(-3_600_000)}>
          -1h
        </IconButton>
        <IconButton
          label={paused ? 'Play' : 'Pause'}
          onClick={() => (paused ? engine.time.setRate(1) : engine.time.pause())}
        >
          {paused ? (
            <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" aria-hidden>
              <path d="M2 1l9 5-9 5z" />
            </svg>
          ) : (
            <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" aria-hidden>
              <path d="M2 1h3v10H2zM7 1h3v10H7z" />
            </svg>
          )}
        </IconButton>
        <IconButton label="Forward 1 hour" onClick={() => engine.time.offsetBy(3_600_000)}>
          +1h
        </IconButton>

        <div className="mx-1 h-5 w-px bg-white/10" />

        <IconButton label="Slower" onClick={() => cycleRate(-1)}>
          −
        </IconButton>
        <span className="w-16 text-center text-xs tabular-nums text-slate-200">
          {timeCtl.live ? '1x live' : `${timeCtl.rate}x`}
        </span>
        <IconButton label="Faster" onClick={() => cycleRate(1)}>
          +
        </IconButton>
        <IconButton
          label="Reverse direction"
          active={direction < 0}
          onClick={() => engine.time.setRate(-timeCtl.rate || -1)}
        >
          rev
        </IconButton>

        <div className="mx-1 h-5 w-px bg-white/10" />

        <span className="min-w-44 text-xs tabular-nums text-slate-300" data-testid="sim-clock">
          {formatUtc(nowMs)}
        </span>
        <IconButton
          label="Return to live time"
          active={timeCtl.live}
          onClick={() => engine.time.resumeLive()}
        >
          LIVE
        </IconButton>
      </div>
    </GlassPanel>
  );
}
