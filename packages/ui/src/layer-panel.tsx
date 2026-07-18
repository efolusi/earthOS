'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { EarthOSPlugin } from '@earthos/core';
import { useEarth, useEarthState } from '@earthos/core/react';
import { GlassPanel, IconButton, Toggle } from './panel';
import { SettingsForm } from './settings-form';

/**
 * The layer switchboard: one row per registered plugin with enable toggle,
 * a per-layer color swatch (matching what it draws on the globe), attribution,
 * and an expandable schema-driven settings form.
 */
export function LayerPanel({ plugins }: { plugins: EarthOSPlugin[] }) {
  const engine = useEarth();
  const layers = useEarthState((s) => s.layers);
  const [expanded, setExpanded] = useState<string | null>(null);
  // Collapse to just the header on phones so the panel never buries the globe.
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia('(max-width: 639px)').matches) {
      setCollapsed(true);
    }
  }, []);

  return (
    <GlassPanel
      title="Layers"
      className="w-[min(20rem,calc(100vw-1rem))]"
      actions={
        <IconButton
          label={collapsed ? 'Expand layers' : 'Collapse layers'}
          onClick={() => setCollapsed((c) => !c)}
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            aria-hidden
            style={{
              transform: collapsed ? 'rotate(-90deg)' : 'none',
              transition: 'transform var(--dur-med) var(--ease-spring)',
            }}
          >
            <path d="M2.5 4.5L6 8l3.5-3.5" />
          </svg>
        </IconButton>
      }
    >
      {collapsed ? null : (
      <ul className="max-h-[26vh] overflow-y-auto py-0.5 sm:max-h-[30vh]">
        {plugins.map((plugin) => {
          const layer = layers[plugin.id];
          const status = layer?.status ?? 'registered';
          const enabled = status === 'active' || status === 'loading';
          const isOpen = expanded === plugin.id;
          const ctx = engine.getContext(plugin.id);
          const swatch = plugin.meta.color ?? 'var(--border-strong)';
          return (
            <li key={plugin.id} className="border-b border-[var(--border-default)] last:border-b-0">
              <div className="flex items-center gap-2.5 px-3.5 py-1.5">
                <span
                  className={`h-2.5 w-2.5 shrink-0 rounded-full ${status === 'loading' ? 'animate-pulse' : ''}`}
                  style={{
                    backgroundColor: status === 'error' ? 'var(--danger-600)' : swatch,
                    opacity: enabled ? 1 : 0.3,
                    boxShadow: status === 'active' ? `0 0 6px ${swatch}` : 'none',
                  }}
                  title={layer?.error ?? status}
                  data-testid={`layer-status-${plugin.id}`}
                  data-status={status}
                />
                <button
                  type="button"
                  aria-expanded={isOpen}
                  aria-label={`${plugin.meta.name} settings`}
                  className="flex min-w-0 flex-1 flex-col rounded-[var(--radius-sm)] text-left leading-tight focus-visible:outline-none focus-visible:[box-shadow:var(--focus-ring)]"
                  onClick={() => setExpanded(isOpen ? null : plugin.id)}
                >
                  <span className="truncate text-[13px] font-medium text-[var(--text-primary)]">
                    {plugin.meta.name}
                  </span>
                  <span className="truncate text-[11px] text-[var(--text-muted)]">
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
      )}
    </GlassPanel>
  );
}
