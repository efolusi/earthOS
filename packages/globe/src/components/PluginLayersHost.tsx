'use client';

import { Component, Suspense, type ReactNode } from 'react';
import { useEarth, useEarthState, useLayerRenderers } from '@earthos/core/react';

class LayerErrorBoundary extends Component<
  { id: string; onError: (id: string, err: unknown) => void; children: ReactNode },
  { failed: boolean }
> {
  override state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  override componentDidCatch(error: unknown): void {
    this.props.onError(this.props.id, error);
  }

  override render(): ReactNode {
    return this.state.failed ? null : this.props.children;
  }
}

/**
 * Mounts every active layer's renderer inside the host Canvas. Renderers are
 * plain React components receiving their PluginContext; a crashing renderer
 * unmounts itself and marks its layer as errored instead of killing the
 * scene.
 */
export function PluginLayersHost() {
  const engine = useEarth();
  const renderers = useLayerRenderers();
  const layers = useEarthState((s) => s.layers);

  const onError = (id: string, err: unknown) => {
    engine.logger.error(`layer "${id}" renderer crashed`, err);
    engine.store.getState().upsertLayer(id, {
      status: 'error',
      error: err instanceof Error ? err.message : String(err),
    });
  };

  return (
    <>
      {renderers.map(([id, renderer]) => {
        const layer = layers[id];
        if (!layer?.visible) return null;
        const ctx = engine.getContext(id);
        if (!ctx) return null;
        const C = renderer.Component;
        return (
          <LayerErrorBoundary key={id} id={id} onError={onError}>
            <Suspense fallback={null}>
              <C ctx={ctx} />
            </Suspense>
          </LayerErrorBoundary>
        );
      })}
    </>
  );
}
