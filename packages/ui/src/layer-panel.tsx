'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { EarthOSPlugin } from '@earthos/core';
import { useEarth, useEarthState } from '@earthos/core/react';
import { GlassPanel, Toggle } from './panel';
import { SettingsForm } from './settings-form';

const STATUS_COLOR: Record<string, string> = {
  active: 'bg-[var(--success-600)]',
  loading: 'bg-[var(--warning-600)] animate-pulse',
  error: 'bg-[var(--danger-600)]',
  registered: 'bg-[var(--border-strong)]',
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
            <li key={plugin.id} className="border-b border-[var(--border-default)] last:border-b-0">
              <div className="flex items-center gap-3 px-4 py-2.5">
                <span
                  className={`h-2 w-2 shrink-0 rounded-full ${STATUS_COLOR[layer?.status ?? 'registered']}`}
                  title={layer?.error ?? layer?.status ?? 'registered'}
                  data-testid={`layer-status-${plugin.id}`}
                  data-status={layer?.status ?? 'registered'}
                />
                <button
                  type="button"
                  aria-expanded={isOpen}
                  aria-label={`${plugin.meta.name} settings`}
                  className="flex min-w-0 flex-1 flex-col rounded-[var(--radius-sm)] text-left focus-visible:outline-none focus-visible:[box-shadow:var(--focus-ring)]"
                  onClick={() => setExpanded(isOpen ? null : plugin.id)}
                >
                  <span className="truncate text-[14px] font-medium text-[var(--text-primary)]">
                    {plugin.meta.name}
                  </span>
                  <span className="truncate text-[12px] text-[var(--text-muted)]">
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
                    transition={{ duration: 0.16, ease: [0.3, 1.04, 0.35, 1] }}
                    className="overflow-hidden bg-[var(--surface-sunken)]"
                  >
                    <SettingsForm schema={plugin.settingsSchema} api={ctx.settings} />
                  </motion.div>
                ) : null}
              </AnimatePresence>
              {layer?.status === 'error' && layer.error ? (
                <p className="px-4 pb-2 text-[12px] text-[var(--danger-600)]">{layer.error}</p>
              ) : null}
            </li>
          );
        })}
      </ul>
    </GlassPanel>
  );
}
