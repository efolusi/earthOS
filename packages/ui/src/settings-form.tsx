'use client';

import { useSyncExternalStore } from 'react';
import type { SettingsAPI, SettingsField, SettingsSchema } from '@earthos/core';

/**
 * Schema-driven settings UI: every plugin gets a settings panel for free
 * from its defineSettings schema. Values read/write through the plugin's
 * SettingsAPI, so validation and persistence stay in core.
 */
export function SettingsForm({ schema, api }: { schema: SettingsSchema; api: SettingsAPI }) {
  const values = useSyncExternalStore(
    (cb) => api.subscribe(() => cb()),
    () => api.get(),
    () => api.get(),
  );

  return (
    <div className="flex flex-col gap-3 px-4 py-3">
      {Object.entries(schema.fields).map(([key, field]) => (
        <Field
          key={key}
          field={field}
          value={values[key]}
          onChange={(v) => api.patch({ [key]: v })}
        />
      ))}
    </div>
  );
}

function Field({
  field,
  value,
  onChange,
}: {
  field: SettingsField;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  const label = (
    <span className="text-xs text-slate-300" title={field.description}>
      {field.label}
      {'unit' in field && field.unit ? (
        <span className="ml-1 text-slate-500">({field.unit})</span>
      ) : null}
    </span>
  );

  switch (field.kind) {
    case 'boolean':
      return (
        <label className="flex items-center justify-between gap-3">
          {label}
          <input
            type="checkbox"
            checked={Boolean(value)}
            onChange={(e) => onChange(e.target.checked)}
            className="h-4 w-4 accent-sky-500"
          />
        </label>
      );
    case 'number':
      return (
        <label className="flex items-center justify-between gap-3">
          {label}
          <input
            type="number"
            value={typeof value === 'number' ? value : field.default}
            min={field.min}
            max={field.max}
            step={field.step ?? 1}
            onChange={(e) => onChange(Number(e.target.value))}
            className="w-24 rounded-md border border-white/10 bg-white/5 px-2 py-1 text-right text-xs text-slate-100 outline-none focus:border-sky-500/60"
          />
        </label>
      );
    case 'select':
      return (
        <label className="flex items-center justify-between gap-3">
          {label}
          <select
            value={String(value ?? field.default)}
            onChange={(e) => onChange(e.target.value)}
            className="w-40 rounded-md border border-white/10 bg-slate-900 px-2 py-1 text-xs text-slate-100 outline-none focus:border-sky-500/60"
          >
            {field.options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      );
    case 'color':
      return (
        <label className="flex items-center justify-between gap-3">
          {label}
          <input
            type="color"
            value={String(value ?? field.default)}
            onChange={(e) => onChange(e.target.value)}
            className="h-6 w-10 cursor-pointer rounded border border-white/10 bg-transparent"
          />
        </label>
      );
    case 'range': {
      const [lo, hi] = Array.isArray(value) ? (value as [number, number]) : field.default;
      return (
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between">
            {label}
            <span className="text-[10px] tabular-nums text-slate-400">
              {lo} to {hi}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min={field.min}
              max={field.max}
              step={field.step ?? 1}
              value={lo}
              onChange={(e) => onChange([Math.min(Number(e.target.value), hi), hi])}
              className="w-full accent-sky-500"
            />
            <input
              type="range"
              min={field.min}
              max={field.max}
              step={field.step ?? 1}
              value={hi}
              onChange={(e) => onChange([lo, Math.max(Number(e.target.value), lo)])}
              className="w-full accent-sky-500"
            />
          </div>
        </div>
      );
    }
    case 'text':
    case 'secret':
      return (
        <label className="flex flex-col gap-1">
          {label}
          <input
            type={field.kind === 'secret' ? 'password' : 'text'}
            value={String(value ?? '')}
            placeholder={'placeholder' in field ? field.placeholder : undefined}
            onChange={(e) => onChange(e.target.value)}
            className="rounded-md border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-slate-100 outline-none placeholder:text-slate-600 focus:border-sky-500/60"
          />
        </label>
      );
  }
}
