import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { defineSettings, f, type SettingsAPI } from '@earthos/core';
import { SettingsForm } from '../src/settings-form';

afterEach(cleanup);

const schema = defineSettings({
  version: 1,
  fields: {
    refreshSeconds: f.number({ label: 'Refresh', min: 5, max: 120, default: 10, unit: 's' }),
    showTrails: f.boolean({ label: 'Trails', default: true }),
    group: f.select({
      label: 'Group',
      options: [
        { value: 'all', label: 'All' },
        { value: 'starlink', label: 'Starlink' },
      ],
      default: 'all',
    }),
  },
});

function stubApi(initial: Record<string, unknown>) {
  let values = { ...initial };
  const subs = new Set<(v: Record<string, unknown>) => void>();
  const patches: Array<Record<string, unknown>> = [];
  const api: SettingsAPI = {
    get: () => values,
    patch: (patch) => {
      patches.push(patch as Record<string, unknown>);
      values = { ...values, ...patch };
      subs.forEach((cb) => cb(values));
    },
    subscribe: (cb) => {
      subs.add(cb);
      return () => subs.delete(cb);
    },
  };
  return { api, patches };
}

describe('SettingsForm (jsdom)', () => {
  it('renders every field kind with current values', () => {
    const { api } = stubApi({ refreshSeconds: 10, showTrails: true, group: 'all' });
    render(<SettingsForm schema={schema} api={api} />);
    expect(screen.getByLabelText(/Refresh/)).toHaveProperty('value', '10');
    expect(screen.getByLabelText('Trails')).toHaveProperty('checked', true);
    expect(screen.getByLabelText('Group')).toHaveProperty('value', 'all');
  });

  it('patches through the SettingsAPI on user input', () => {
    const { api, patches } = stubApi({ refreshSeconds: 10, showTrails: true, group: 'all' });
    render(<SettingsForm schema={schema} api={api} />);

    fireEvent.change(screen.getByLabelText(/Refresh/), { target: { value: '30' } });
    fireEvent.click(screen.getByLabelText('Trails'));
    fireEvent.change(screen.getByLabelText('Group'), { target: { value: 'starlink' } });

    expect(patches).toEqual([{ refreshSeconds: 30 }, { showTrails: false }, { group: 'starlink' }]);
  });

  it('reflects external settings changes (subscription)', () => {
    const { api } = stubApi({ refreshSeconds: 10, showTrails: true, group: 'all' });
    render(<SettingsForm schema={schema} api={api} />);
    act(() => api.patch({ refreshSeconds: 99 }));
    expect(screen.getByLabelText(/Refresh/)).toHaveProperty('value', '99');
  });
});
