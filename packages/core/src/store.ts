import { createStore, type StoreApi } from 'zustand/vanilla';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { CameraSnapshot, EntityRef, LayerKind, LayerStatus } from './types';

export interface LayerUIState {
  status: LayerStatus;
  kind: LayerKind;
  visible: boolean;
  opacity: number;
  zOrder: number;
  error?: string;
}

export interface TimeCtlState {
  rate: number;
  live: boolean;
  /** Low-frequency mirror for UI readouts; NOT the per-frame clock. */
  epochMs: number;
}

export interface EarthState {
  layers: Record<string, LayerUIState>;
  /** Persisted per-layer preferences that survive unregister/re-register. */
  layerPrefs: Record<string, { visible: boolean }>;
  timeCtl: TimeCtlState;
  camera: CameraSnapshot;
  selection: { picked: EntityRef | null; hovered: EntityRef | null };
  settings: Record<string, Record<string, unknown>>;

  upsertLayer(id: string, patch: Partial<LayerUIState>): void;
  removeLayer(id: string): void;
  setLayerVisible(id: string, visible: boolean): void;
  setTimeCtl(patch: Partial<TimeCtlState>): void;
  setCameraSnapshot(snap: CameraSnapshot): void;
  setSelected(ref: EntityRef | null): void;
  setHovered(ref: EntityRef | null): void;
  replaceSettings(pluginId: string, values: Record<string, unknown>): void;
  patchSettings(pluginId: string, patch: Record<string, unknown>): void;
}

export type EarthStore = StoreApi<EarthState>;

export const DEFAULT_CAMERA: CameraSnapshot = {
  lat: 15,
  lon: 0,
  altKm: 20000,
  heading: 0,
  pitch: 0,
};

const DEFAULT_LAYER: Omit<LayerUIState, 'status'> = {
  kind: 'scene',
  visible: false,
  opacity: 1,
  zOrder: 0,
};

function stateCreator(set: (fn: (s: EarthState) => Partial<EarthState>) => void): EarthState {
  return {
    layers: {},
    layerPrefs: {},
    timeCtl: { rate: 1, live: true, epochMs: Date.now() },
    camera: DEFAULT_CAMERA,
    selection: { picked: null, hovered: null },
    settings: {},

    upsertLayer: (id, patch) =>
      set((s) => {
        const existing = s.layers[id];
        const pref = s.layerPrefs[id];
        const base: LayerUIState = existing ?? {
          ...DEFAULT_LAYER,
          status: 'registered',
          visible: pref?.visible ?? false,
        };
        return { layers: { ...s.layers, [id]: { ...base, ...patch } } };
      }),

    removeLayer: (id) =>
      set((s) => {
        const layers = { ...s.layers };
        delete layers[id];
        return { layers };
      }),

    setLayerVisible: (id, visible) =>
      set((s) => {
        const layer = s.layers[id];
        if (!layer) return {};
        return {
          layers: { ...s.layers, [id]: { ...layer, visible } },
          layerPrefs: { ...s.layerPrefs, [id]: { visible } },
        };
      }),

    setTimeCtl: (patch) => set((s) => ({ timeCtl: { ...s.timeCtl, ...patch } })),
    setCameraSnapshot: (snap) => set(() => ({ camera: snap })),
    setSelected: (ref) => set((s) => ({ selection: { ...s.selection, picked: ref } })),
    setHovered: (ref) => set((s) => ({ selection: { ...s.selection, hovered: ref } })),

    replaceSettings: (pluginId, values) =>
      set((s) => ({ settings: { ...s.settings, [pluginId]: values } })),

    patchSettings: (pluginId, patch) =>
      set((s) => ({
        settings: {
          ...s.settings,
          [pluginId]: { ...(s.settings[pluginId] ?? {}), ...patch },
        },
      })),
  };
}

export interface CreateEarthStoreOptions {
  /** localStorage key, or false to disable persistence (default in non-browser). */
  persistKey?: string | false;
}

export function createEarthStore(opts: CreateEarthStoreOptions = {}): EarthStore {
  const persistKey = opts.persistKey ?? 'earthos:v1';
  const canPersist = persistKey !== false && typeof window !== 'undefined';

  if (!canPersist) {
    return createStore<EarthState>()((set) => stateCreator(set));
  }

  return createStore<EarthState>()(
    persist((set) => stateCreator(set), {
      name: persistKey,
      version: 1,
      storage: createJSONStorage(() => window.localStorage),
      partialize: (s) => ({
        layerPrefs: s.layerPrefs,
        settings: s.settings,
        camera: s.camera,
      }),
      merge: (persisted, current) => ({
        ...current,
        ...(persisted as Partial<EarthState>),
      }),
    }),
  );
}
