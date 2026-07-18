// Components
export { Earth, type EarthProps } from './earth';
export { Layer, type LayerProps } from './layer';
export {
  LayerImagery,
  LayerSatellites,
  LayerAircraft,
  LayerEarthquakes,
  LayerDayNight,
  LayerGeoJson,
  type LayerImageryProps,
  type LayerSatellitesProps,
  type LayerAircraftProps,
  type LayerEarthquakesProps,
  type LayerDayNightProps,
  type LayerGeoJsonProps,
} from './layers';

// UI kit (optional, tree-shakeable)
export {
  LayerPanel,
  Timeline,
  Inspector,
  CommandPalette,
  StatusBar,
  HoverCard,
  GlassPanel,
  SettingsForm,
} from '@earthos/ui';

// Hooks
export {
  useEarth,
  useEarthState,
  useSimTime,
  useLayer,
  useLayerRenderers,
  EarthEngineProvider,
} from '@earthos/core/react';

// Engine + plugin authoring (headless / imperative API)
export {
  createEarthEngine,
  definePlugin,
  defineSettings,
  f,
  PLUGIN_API_VERSION,
  type EarthEngine,
  type EarthEngineOptions,
  type EarthOSPlugin,
  type PluginContext,
  type LayerRenderer,
  type ProviderInstance,
  type ProviderSnapshot,
  type EntityRef,
  type EntityInfo,
  type SettingsSchema,
} from '@earthos/core';
export { DataProvider, StaticProvider, StreamProvider, TileProvider } from '@earthos/providers';
export { EarthCanvas, useEarthFixed, ExtrapolatedPointsLayer } from '@earthos/globe';
export { geodeticToScene, eciToScene, subsolarPoint, EARTH_RADIUS_KM } from '@earthos/gis';
