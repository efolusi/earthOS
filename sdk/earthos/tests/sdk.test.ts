import { describe, expect, it } from 'vitest';
import { createEarthEngine, definePlugin, PLUGIN_API_VERSION } from '../src/index';

describe('earthos SDK surface', () => {
  it('exposes the headless engine API', async () => {
    const engine = createEarthEngine({ persistKey: false });
    const plugin = definePlugin({
      id: 'sdk-check',
      apiVersion: PLUGIN_API_VERSION,
      meta: { name: 'SDK check', category: 'custom' },
    });
    await engine.register(plugin);
    await engine.activate('sdk-check');
    expect(engine.store.getState().layers['sdk-check']?.status).toBe('active');
    await engine.destroy();
  });

  it('exports the component surface', async () => {
    const mod = await import('../src/index');
    for (const name of [
      'Earth',
      'Layer',
      'LayerSatellites',
      'LayerEarthquakes',
      'LayerDayNight',
      'LayerGeoJson',
      'useEarth',
      'DataProvider',
    ]) {
      expect(mod, `missing export: ${name}`).toHaveProperty(name);
    }
  });
});
