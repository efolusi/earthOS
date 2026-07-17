'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { EarthOSPlugin } from '@earthos/core';
import { useEarth, useEarthState } from '@earthos/core/react';
import { GlassPanel, Toggle } from './panel';
import { SettingsForm } from './settings-form';

const STATUS_COLOR: Record<string, string> = {
  active: 'bg-emerald-400',
  loading: 'bg-amber-400 animate-pulse',
  error: 'bg-rose-500',
  registered: 'bg-slate-600',
};

/**
 * The layer switchboard: one row per registered plugin with enable toggle,
 * status dot, attribution, and an expandable schema-driven settings form.
 */
export function LayerPanel({ plugins }: { plugins: EarthOSPlugin[] }) {
  const engine = useEarth();
  const layers = useEarthState((s) => s.layers);
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <GlassPanel title="Layers" className="w-80">
      <ul className="max-h-[46vh] overflow-y-auto py-1">
        {plugins.map((plugin) => {
          const layer = layers[plugin.id];
          const enabled = layer?.status === 'active' || layer?.status === 'loading';
          const isOpen = expanded === plugin.id;
          const ctx = engine.getContext(plugin.id);
          return (
            <li key={plugin.id} className="border-b border-white/5 last:border-b-0">
              <div className="flex items-center gap-3 px-4 py-2.5">
                <span
                  className={`h-2 w-2 shrink-0 rounded-full ${STATUS_COLOR[layer?.status ?? 'registered']}`}
                  title={layer?.error ?? layer?.status ?? 'registered'}
                  data-testid={`layer-status-${plugin.id}`}
                  data-status={layer?.status ?? 'registered'}
                />
                <button
                  type="button"
                  className="flex min-w-0 flex-1 flex-col text-left"
                  onClick={() => setExpanded(isOpen ? null : plugin.id)}
                >
                  <span className="truncate text-sm font-medium text-slate-100">
                    {plugin.meta.name}
                  </span>
                  <span className="truncate text-[11px] text-slate-500">
                    {plugin.meta.attribution ?? plugin.meta.description ?? plugin.meta.category}
                  </span>
                </button>
                <Toggle
                  checked={enabled}
                  label={`Toggle ${plugin.meta.name}`}
                  onChange={(next) => {
                    void engine.setLayerEnabled(plugin.id, next).catch(() => undefined);
                  }}
                />
              </div>
              <AnimatePresence initial={false}>
                {isOpen && plugin.settingsSchema && ctx ? (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.18 }}
                    className="overflow-hidden bg-black/20"
                  >
                    <SettingsForm schema={plugin.settingsSchema} api={ctx.settings} />
                  </motion.div>
                ) : null}
              </AnimatePresence>
              {layer?.status === 'error' && layer.error ? (
                <p className="px-4 pb-2 text-[11px] text-rose-400">{layer.error}</p>
              ) : null}
            </li>
          );
        })}
      </ul>
    </GlassPanel>
  );
}
