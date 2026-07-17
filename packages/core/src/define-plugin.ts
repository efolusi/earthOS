import type { SettingsSchema } from './settings';
import type {
  EarthOSPlugin,
  LayerDeclaration,
  LayerRenderer,
  PluginContext,
  PluginMeta,
  ProviderHandle,
  ProviderInstance,
} from './types';
import type { PLUGIN_API_VERSION } from './types';

/** provider.ts default export: a factory building the provider from context. */
export type ProviderFactory = (ctx: PluginContext) => ProviderInstance<unknown>;
export type ProviderModule = { default: ProviderFactory };
export type RendererModule = { default: LayerRenderer };

export interface DefinePluginInput {
  id: string;
  apiVersion: typeof PLUGIN_API_VERSION;
  meta: PluginMeta;
  settings?: SettingsSchema;
  layer?: LayerDeclaration;
  /** Lazy split point: imported only when the layer is enabled. */
  provider?: () => Promise<ProviderModule>;
  /** Lazy split point: the only module allowed to import three. */
  renderer?: () => Promise<RendererModule>;
  /** Optional extra lifecycle work. */
  onRegister?(ctx: PluginContext): void | Promise<void>;
  onActivate?(ctx: PluginContext): void | Promise<void>;
  onDeactivate?(ctx: PluginContext): void | Promise<void>;
  onDispose?(ctx: PluginContext): void | Promise<void>;
}

/**
 * Compose a full EarthOSPlugin from the mandated file shape. `plugin.ts`
 * stays cheap (no three, no provider code); enabling the layer dynamic-
 * imports provider/renderer so disabled plugins cost zero bytes.
 */
export function definePlugin(input: DefinePluginInput): EarthOSPlugin {
  let providerHandle: ProviderHandle<unknown> | null = null;

  return {
    id: input.id,
    apiVersion: input.apiVersion,
    meta: input.meta,
    settingsSchema: input.settings,

    async register(ctx) {
      ctx.layers.declare(input.layer ?? { kind: 'scene' });
      await input.onRegister?.(ctx);
    },

    async activate(ctx) {
      const [providerMod, rendererMod] = await Promise.all([
        input.provider?.(),
        input.renderer?.(),
      ]);
      if (ctx.signal.aborted) return;
      if (providerMod) {
        providerHandle = ctx.providers.attach(providerMod.default(ctx));
      }
      if (rendererMod) {
        await rendererMod.default.preload?.(ctx);
        if (ctx.signal.aborted) return;
        ctx.layers.setRenderer(rendererMod.default);
      }
      await input.onActivate?.(ctx);
    },

    async deactivate(ctx) {
      providerHandle?.detach();
      providerHandle = null;
      ctx.layers.clearRenderer();
      await input.onDeactivate?.(ctx);
    },

    async dispose(ctx) {
      await input.onDispose?.(ctx);
    },
  };
}
