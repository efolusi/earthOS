import { describe, expect, it } from 'vitest';
import {
  defineSettings,
  f,
  hydrateSettings,
  settingsDefaults,
  validateSettingsPatch,
} from '../src/settings';

const schema = defineSettings({
  version: 2,
  fields: {
    refreshSeconds: f.number({ label: 'Refresh', min: 5, max: 120, default: 10, unit: 's' }),
    showTrails: f.boolean({ label: 'Trails', default: true }),
    altitudeBand: f.range({ label: 'Altitude', min: 0, max: 60_000, default: [0, 60_000] }),
    group: f.select({
      label: 'Group',
      options: [
        { value: 'all', label: 'All' },
        { value: 'starlink', label: 'Starlink' },
      ],
      default: 'all',
    }),
    color: f.color({ default: '#7dd3fc', label: 'Color' }),
    apiKey: f.secret({ label: 'API key', default: '', optional: true }),
  },
  migrate: (old, from) => {
    if (from === 1 && typeof old.refresh === 'number') {
      return { ...old, refreshSeconds: old.refresh };
    }
    return old;
  },
});

describe('settings DSL', () => {
  it('produces defaults', () => {
    const d = settingsDefaults(schema);
    expect(d).toEqual({
      refreshSeconds: 10,
      showTrails: true,
      altitudeBand: [0, 60_000],
      group: 'all',
      color: '#7dd3fc',
      apiKey: '',
    });
  });

  it('range defaults are copies, not shared references', () => {
    const a = settingsDefaults(schema);
    const b = settingsDefaults(schema);
    expect(a.altitudeBand).not.toBe(b.altitudeBand);
  });

  it('accepts valid patches', () => {
    const r = validateSettingsPatch(schema, { refreshSeconds: 30, group: 'starlink' });
    expect(r).toEqual({ ok: true, value: { refreshSeconds: 30, group: 'starlink' } });
  });

  it('rejects out-of-bounds numbers', () => {
    const r = validateSettingsPatch(schema, { refreshSeconds: 2 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.refreshSeconds).toContain('>= 5');
  });

  it('rejects unknown keys, bad selects, bad colors, inverted ranges', () => {
    const r = validateSettingsPatch(schema, {
      nope: 1,
      group: 'oneweb',
      color: 'red',
      altitudeBand: [50, 10],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(Object.keys(r.errors).sort()).toEqual(['altitudeBand', 'color', 'group', 'nope']);
    }
  });

  it('hydrates persisted values over defaults, dropping invalid ones', () => {
    const v = hydrateSettings(schema, { refreshSeconds: 60, color: 'not-a-color', junk: true });
    expect(v.refreshSeconds).toBe(60);
    expect(v.color).toBe('#7dd3fc');
    expect('junk' in v).toBe(false);
  });

  it('runs migrations for older versions', () => {
    const v = hydrateSettings(schema, { refresh: 45 }, 1);
    expect(v.refreshSeconds).toBe(45);
  });
});
