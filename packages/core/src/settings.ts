/**
 * Tiny home-grown settings DSL. It is UI-renderable metadata first,
 * validation second, deliberately not a general schema library: seven field
 * kinds cover every plugin, and keeping it in-house means 35 independent
 * plugins are never pinned to a third-party validator's semver.
 */

export interface TextField {
  kind: 'text';
  label: string;
  description?: string;
  placeholder?: string;
  default: string;
}

export interface SecretField {
  kind: 'secret';
  label: string;
  description?: string;
  default: string;
  optional?: boolean;
}

export interface NumberField {
  kind: 'number';
  label: string;
  description?: string;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  default: number;
}

export interface BooleanField {
  kind: 'boolean';
  label: string;
  description?: string;
  default: boolean;
}

export interface RangeField {
  kind: 'range';
  label: string;
  description?: string;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  default: [number, number];
}

export interface SelectField<V extends string = string> {
  kind: 'select';
  label: string;
  description?: string;
  options: ReadonlyArray<{ value: V; label: string }>;
  default: V;
}

export interface ColorField {
  kind: 'color';
  label: string;
  description?: string;
  /** #rgb, #rrggbb or #rrggbbaa */
  default: string;
}

export type SettingsField =
  TextField | SecretField | NumberField | BooleanField | RangeField | SelectField | ColorField;

export interface SettingsSchema<
  F extends Record<string, SettingsField> = Record<string, SettingsField>,
> {
  version: number;
  fields: F;
  /** Upgrade persisted values written by an older schema version. */
  migrate?: (persisted: Record<string, unknown>, fromVersion: number) => Record<string, unknown>;
}

/** Inferred value type of a schema: `{ refreshSeconds: number, ... }`. */
export type SettingsValues<S extends SettingsSchema> = {
  [K in keyof S['fields']]: S['fields'][K]['default'];
};

/** Field factory helpers: `f.number({ label: 'Refresh', default: 10 })`. */
export const f = {
  text: (o: Omit<TextField, 'kind'>): TextField => ({ kind: 'text', ...o }),
  secret: (o: Omit<SecretField, 'kind'>): SecretField => ({ kind: 'secret', ...o }),
  number: (o: Omit<NumberField, 'kind'>): NumberField => ({ kind: 'number', ...o }),
  boolean: (o: Omit<BooleanField, 'kind'>): BooleanField => ({ kind: 'boolean', ...o }),
  range: (o: Omit<RangeField, 'kind'>): RangeField => ({ kind: 'range', ...o }),
  select: <V extends string>(o: Omit<SelectField<V>, 'kind'>): SelectField<V> => ({
    kind: 'select',
    ...o,
  }),
  color: (o: Omit<ColorField, 'kind'>): ColorField => ({ kind: 'color', ...o }),
};

export function defineSettings<F extends Record<string, SettingsField>>(
  schema: SettingsSchema<F>,
): SettingsSchema<F> {
  return schema;
}

export function settingsDefaults(schema: SettingsSchema): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, field] of Object.entries(schema.fields)) {
    out[key] = field.kind === 'range' ? [...field.default] : field.default;
  }
  return out;
}

const COLOR_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

function validateField(field: SettingsField, value: unknown): string | null {
  switch (field.kind) {
    case 'text':
    case 'secret':
      return typeof value === 'string' ? null : 'expected a string';
    case 'boolean':
      return typeof value === 'boolean' ? null : 'expected a boolean';
    case 'number': {
      if (typeof value !== 'number' || !Number.isFinite(value)) return 'expected a finite number';
      if (field.min !== undefined && value < field.min) return `must be >= ${field.min}`;
      if (field.max !== undefined && value > field.max) return `must be <= ${field.max}`;
      return null;
    }
    case 'range': {
      if (
        !Array.isArray(value) ||
        value.length !== 2 ||
        typeof value[0] !== 'number' ||
        typeof value[1] !== 'number'
      ) {
        return 'expected [low, high]';
      }
      const [lo, hi] = value as [number, number];
      if (lo > hi) return 'low bound exceeds high bound';
      if (lo < field.min || hi > field.max) return `must stay within [${field.min}, ${field.max}]`;
      return null;
    }
    case 'select':
      return field.options.some((o) => o.value === value) ? null : 'not a valid option';
    case 'color':
      return typeof value === 'string' && COLOR_RE.test(value) ? null : 'expected a hex color';
  }
}

export type SettingsValidation =
  { ok: true; value: Record<string, unknown> } | { ok: false; errors: Record<string, string> };

/** Validate a partial patch against a schema. Unknown keys are rejected. */
export function validateSettingsPatch(
  schema: SettingsSchema,
  patch: Record<string, unknown>,
): SettingsValidation {
  const errors: Record<string, string> = {};
  const value: Record<string, unknown> = {};
  for (const [key, raw] of Object.entries(patch)) {
    const field = schema.fields[key];
    if (!field) {
      errors[key] = 'unknown setting';
      continue;
    }
    const err = validateField(field, raw);
    if (err) errors[key] = err;
    else value[key] = raw;
  }
  return Object.keys(errors).length > 0 ? { ok: false, errors } : { ok: true, value };
}

/**
 * Reconcile persisted values with the current schema: run migrations, drop
 * unknown keys, replace invalid values with defaults.
 */
export function hydrateSettings(
  schema: SettingsSchema,
  persisted: Record<string, unknown> | undefined,
  persistedVersion?: number,
): Record<string, unknown> {
  let incoming = persisted ?? {};
  const fromVersion = persistedVersion ?? schema.version;
  if (fromVersion !== schema.version && schema.migrate) {
    incoming = schema.migrate(incoming, fromVersion);
  }
  const out = settingsDefaults(schema);
  for (const [key, raw] of Object.entries(incoming)) {
    const field = schema.fields[key];
    if (field && validateField(field, raw) === null) out[key] = raw;
  }
  return out;
}
