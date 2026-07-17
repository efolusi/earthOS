'use client';

import { useSyncExternalStore } from 'react';
import type { SettingsAPI, SettingsField, SettingsSchema } from '@earthos/core';

const inputBase =
  'rounded-[var(--radius-sm)] border border-[var(--border-default)] bg-[var(--surface-card)] text-[13px] text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)] focus:[box-shadow:var(--focus-ring)] transition-shadow duration-100';

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
    <span className="text-[13px] text-[var(--text-secondary)]" title={field.description}>
      {field.label}
      {'unit' in field && field.unit ? (
        <span className="ml-1 text-[var(--text-muted)]">({field.unit})</span>
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
            className="h-4 w-4 accent-[var(--brand-500)]"
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
            className={`${inputBase} w-24 px-2 py-1 text-right font-[family-name:var(--font-mono)]`}
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
            className={`${inputBase} w-40 px-2 py-1`}
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
            className="h-6 w-10 cursor-pointer rounded-[var(--radius-sm)] border border-[var(--border-default)] bg-transparent"
          />
        </label>
      );
    case 'range': {
      const [lo, hi] = Array.isArray(value) ? (value as [number, number]) : field.default;
      return (
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between">
            {label}
            <span className="font-[family-name:var(--font-mono)] text-[11px] text-[var(--text-muted)]">
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
              className="w-full accent-[var(--brand-500)]"
            />
            <input
              type="range"
              min={field.min}
              max={field.max}
              step={field.step ?? 1}
              value={hi}
              onChange={(e) => onChange([lo, Math.max(Number(e.target.value), lo)])}
              className="w-full accent-[var(--brand-500)]"
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
            className={`${inputBase} px-2 py-1.5`}
          />
        </label>
      );
  }
}
