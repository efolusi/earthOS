// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
// Types must come from the package entry (dist): src/react.tsx references
// '@earthos/core' itself, and the two declaration sets are not nominally
// interchangeable (private class members).
import { createEarthEngine, definePlugin, type EarthEngine } from '@earthos/core';
import { EarthEngineProvider, useEarthState, useLayer, useLayerRenderers } from '../src/react';

const silent = { debug() {}, info() {}, warn() {}, error() {} };

function makeEngine(): EarthEngine {
  return createEarthEngine({ persistKey: false, logger: silent });
}

afterEach(cleanup);

function LayerStatus({ id }: { id: string }) {
  const status = useEarthState((s) => s.layers[id]?.status ?? 'unregistered');
  return <span data-testid="status">{status}</span>;
}

describe('core react bindings (jsdom)', () => {
  it('useEarthState re-renders on store changes', async () => {
    const engine = makeEngine();
    render(
      <EarthEngineProvider engine={engine}>
        <LayerStatus id="demo" />
      </EarthEngineProvider>,
    );
    expect(screen.getByTestId('status').textContent).toBe('unregistered');

    const plugin = definePlugin({
      id: 'demo',
      apiVersion: 1,
      meta: { name: 'Demo', category: 'custom' },
    });
    await act(async () => {
      await engine.register(plugin);
    });
    expect(screen.getByTestId('status').textContent).toBe('registered');
    await act(async () => {
      await engine.activate('demo');
    });
    expect(screen.getByTestId('status').textContent).toBe('active');
  });

  it('useLayer registers from a loader, activates, and deactivates on unmount', async () => {
    const engine = makeEngine();
    const loader = async () => ({
      default: definePlugin({
        id: 'lazy',
        apiVersion: 1,
        meta: { name: 'Lazy', category: 'custom' },
      }),
    });

    function Controller() {
      const layer = useLayer(loader);
      return <span data-testid="layer">{layer.status}</span>;
    }

    const view = render(
      <EarthEngineProvider engine={engine}>
        <Controller />
      </EarthEngineProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('layer').textContent).toBe('active'));

    view.unmount();
    await waitFor(() => expect(engine.store.getState().layers.lazy?.status).toBe('registered'));
  });

  it('useLayerRenderers tracks the renderer registry', async () => {
    const engine = makeEngine();
    const plugin = definePlugin({
      id: 'drawn',
      apiVersion: 1,
      meta: { name: 'Drawn', category: 'custom' },
      renderer: async () => ({ default: { Component: () => null } }),
    });

    function RendererCount() {
      const renderers = useLayerRenderers();
      return <span data-testid="count">{renderers.length}</span>;
    }

    render(
      <EarthEngineProvider engine={engine}>
        <RendererCount />
      </EarthEngineProvider>,
    );
    expect(screen.getByTestId('count').textContent).toBe('0');
    await act(async () => {
      await engine.register(plugin);
      await engine.activate('drawn');
    });
    expect(screen.getByTestId('count').textContent).toBe('1');
    await act(async () => {
      await engine.deactivate('drawn');
    });
    expect(screen.getByTestId('count').textContent).toBe('0');
  });
});
