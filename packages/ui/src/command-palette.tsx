'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { EntityHit } from '@earthos/core';
import { useEarth } from '@earthos/core/react';

/**
 * Cmd/Ctrl+K search across every active layer's entity source (satellites by
 * name or NORAD id, quake locations, GeoJSON features) plus layer toggles.
 * Selecting an entity picks it and flies the camera there.
 */
export function CommandPalette() {
  const engine = useEarth();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<EntityHit[]>([]);
  const [highlight, setHighlight] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const searchSeq = useRef(0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === 'Escape') {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (open) {
      setQuery('');
      setHits([]);
      setHighlight(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const seq = ++searchSeq.current;
    const timer = setTimeout(async () => {
      const results = await engine.search(query, 12).catch(() => []);
      if (searchSeq.current === seq) {
        setHits(results);
        setHighlight(0);
      }
    }, 120);
    return () => clearTimeout(timer);
  }, [engine, open, query]);

  const choose = useCallback(
    async (hit: EntityHit) => {
      setOpen(false);
      engine.store.getState().setSelected(hit.ref);
      const info = await engine.getEntityInfo(hit.ref).catch(() => undefined);
      if (info?.position) {
        engine.events.emit('core:camera:flyTo', {
          lat: info.position.lat,
          lon: info.position.lon,
          altKm: Math.max(info.position.altKm * 3, 2_000),
        });
      }
    },
    [engine],
  );

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="pointer-events-auto fixed inset-0 z-50 flex items-start justify-center bg-black/50 pt-[18vh] backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <motion.div
            initial={{ scale: 0.97, y: -8 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.97, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="w-[36rem] max-w-[92vw] overflow-hidden rounded-2xl border border-white/10 bg-slate-950/90 shadow-2xl backdrop-blur-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  setHighlight((h) => Math.min(h + 1, hits.length - 1));
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  setHighlight((h) => Math.max(h - 1, 0));
                } else if (e.key === 'Enter' && hits[highlight]) {
                  void choose(hits[highlight]!);
                }
              }}
              placeholder="Search satellites, earthquakes, places... (ISS, Starlink-1234, Tokyo)"
              className="w-full border-b border-white/10 bg-transparent px-5 py-4 text-sm text-slate-100 outline-none placeholder:text-slate-600"
              data-testid="command-palette-input"
            />
            <ul className="max-h-80 overflow-y-auto py-1">
              {hits.map((hit, i) => (
                <li key={`${hit.ref.layerId}:${hit.ref.entityId}:${i}`}>
                  <button
                    type="button"
                    onClick={() => void choose(hit)}
                    onMouseEnter={() => setHighlight(i)}
                    className={`flex w-full items-baseline justify-between gap-4 px-5 py-2 text-left ${
                      i === highlight ? 'bg-sky-500/15' : ''
                    }`}
                  >
                    <span className="truncate text-sm text-slate-100">{hit.label}</span>
                    <span className="shrink-0 text-[11px] text-slate-500">
                      {hit.detail ?? hit.ref.layerId}
                    </span>
                  </button>
                </li>
              ))}
              {query && hits.length === 0 ? (
                <li className="px-5 py-6 text-center text-xs text-slate-600">
                  No matches. Enable more layers to broaden search.
                </li>
              ) : null}
            </ul>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
