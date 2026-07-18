'use client';

import { useEffect, useState } from 'react';
import type { EntityInfo } from '@earthos/core';
import { useEarth, useEarthState } from '@earthos/core/react';
import { GlassPanel, IconButton } from './panel';

/**
 * Selected-entity details: live properties (refreshed at 1 Hz through the
 * plugin's entity source), fly-to and follow actions.
 */
export function Inspector() {
  const engine = useEarth();
  const picked = useEarthState((s) => s.selection.picked);
  const [info, setInfo] = useState<EntityInfo | null>(null);

  useEffect(() => {
    if (!picked) {
      setInfo(null);
      return;
    }
    let cancelled = false;
    const load = async () => {
      const next = await engine.getEntityInfo(picked).catch(() => undefined);
      if (!cancelled) setInfo(next ?? null);
    };
    void load();
    const interval = setInterval(load, 1000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [engine, picked]);

  if (!picked) return null;

  return (
    <GlassPanel
      title="Inspector"
      className="w-[min(20rem,calc(100vw-1rem))]"
      actions={
        <IconButton label="Close" onClick={() => engine.store.getState().setSelected(null)}>
          <svg
            width="10"
            height="10"
            viewBox="0 0 10 10"
            stroke="currentColor"
            strokeWidth="1.5"
            aria-hidden
          >
            <path d="M1 1l8 8M9 1l-8 8" />
          </svg>
        </IconButton>
      }
    >
      <div className="px-4 py-3" data-testid="inspector-body">
        <p className="font-[family-name:var(--font-display)] text-[16px] font-semibold tracking-[var(--tracking-display)] text-[var(--text-primary)]">
          {info?.label ?? picked.entityId}
        </p>
        <p className="text-[12px] text-[var(--text-muted)]">layer: {picked.layerId}</p>

        {info?.properties ? (
          <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5">
            {Object.entries(info.properties).map(([key, value]) => (
              <FragmentRow key={key} name={key} value={value} />
            ))}
          </dl>
        ) : (
          <p className="mt-3 text-[13px] text-[var(--text-muted)]">No details yet.</p>
        )}

        <div className="mt-4 flex gap-2">
          {info?.position ? (
            <IconButton
              label="Fly to"
              className="flex-1 border border-[var(--border-default)]"
              onClick={() => {
                const p = info.position!;
                engine.events.emit('core:camera:flyTo', {
                  lat: p.lat,
                  lon: p.lon,
                  altKm: Math.max(p.altKm * 3, 2_000),
                });
              }}
            >
              Fly to
            </IconButton>
          ) : null}
          <IconButton
            label="Follow"
            className="flex-1 border border-[var(--border-default)]"
            onClick={() => engine.events.emit('core:camera:follow', picked)}
          >
            Follow
          </IconButton>
        </div>
      </div>
    </GlassPanel>
  );
}

function FragmentRow({ name, value }: { name: string; value: unknown }) {
  const text = String(value ?? '');
  const isLink = text.startsWith('http');
  return (
    <>
      <dt className="text-[12px] text-[var(--text-muted)]">{name}</dt>
      <dd className="truncate text-right font-[family-name:var(--font-mono)] text-[12px] text-[var(--text-primary)]">
        {isLink ? (
          <a
            href={text}
            target="_blank"
            rel="noreferrer"
            className="font-[family-name:var(--font-sans)] text-[var(--text-link)] hover:underline"
          >
            open
          </a>
        ) : (
          text
        )}
      </dd>
    </>
  );
}
