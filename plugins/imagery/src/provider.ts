import type { PluginContext, ProviderInstance } from '@earthos/core';
import { TileProvider, type TileDescriptor } from '@earthos/providers';

export interface ImageryDescriptor extends TileDescriptor {
  maxZoom: number;
}

const SOURCES: Record<string, { template: string; attribution: string }> = {
  esri: {
    template:
      'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Esri, Maxar, Earthstar Geographics',
  },
  eox: {
    template:
      'https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2020_3857/default/g/{z}/{y}/{x}.jpg',
    attribution: 'Sentinel-2 cloudless by EOX (contains modified Copernicus data)',
  },
};

/** Emits the tile template the renderer streams from; refresh re-describes. */
export class ImageryTileProvider extends TileProvider<ImageryDescriptor> {
  readonly id = 'imagery-tiles';

  describe(settings: Record<string, unknown>): ImageryDescriptor {
    const source = typeof settings.source === 'string' ? settings.source : 'esri';
    const maxZoom = typeof settings.maxZoom === 'number' ? settings.maxZoom : 12;
    if (source === 'custom') {
      const template = typeof settings.template === 'string' ? settings.template.trim() : '';
      if (!template.includes('{z}')) throw new Error('custom template needs {z}/{x}/{y}');
      return { template, attribution: 'custom source', maxZoom, tileSize: 256 };
    }
    const preset = SOURCES[source] ?? SOURCES.esri!;
    return { ...preset, maxZoom, tileSize: 256 };
  }
}

const createProvider = (_ctx: PluginContext): ProviderInstance<unknown> =>
  new ImageryTileProvider() as ProviderInstance<unknown>;

export default createProvider;
