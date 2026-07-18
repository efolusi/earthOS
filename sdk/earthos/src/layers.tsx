'use client';

import { Layer } from './layer';

interface CommonLayerProps {
  enabled?: boolean;
}

/**
 * Thin typed wrappers over <Layer/> for the official plugins. Each is a few
 * lines: third-party plugins compose the same way without wrappers.
 */

export interface LayerSatellitesProps extends CommonLayerProps {
  group?: 'starlink' | 'active' | 'stations' | 'gps-ops' | 'oneweb' | 'geo' | 'weather' | 'science';
  pointSize?: number;
  color?: string;
  showOrbit?: boolean;
  maxSatellites?: number;
  endpoint?: string;
}

export function LayerSatellites({ enabled, ...settings }: LayerSatellitesProps) {
  return (
    <Layer
      manifest={() => import('@earthos/plugin-satellites')}
      enabled={enabled}
      settings={settings}
    />
  );
}

export interface LayerEarthquakesProps extends CommonLayerProps {
  feed?: 'all_hour' | 'all_day' | 'all_week' | 'all_month';
  minMagnitude?: number;
  endpoint?: string;
}

export function LayerEarthquakes({ enabled, ...settings }: LayerEarthquakesProps) {
  return (
    <Layer
      manifest={() => import('@earthos/plugin-earthquakes')}
      enabled={enabled}
      settings={settings}
    />
  );
}

export interface LayerDayNightProps extends CommonLayerProps {
  showTerminator?: boolean;
  showSubsolar?: boolean;
  showSublunar?: boolean;
  lineColor?: string;
}

export function LayerDayNight({ enabled, ...settings }: LayerDayNightProps) {
  return (
    <Layer
      manifest={() => import('@earthos/plugin-daynight')}
      enabled={enabled}
      settings={settings}
    />
  );
}

export interface LayerGeoJsonProps extends CommonLayerProps {
  url?: string;
  color?: string;
  pointSize?: number;
  altitudeKm?: number;
}

export function LayerGeoJson({ enabled, ...settings }: LayerGeoJsonProps) {
  return (
    <Layer
      manifest={() => import('@earthos/plugin-geojson')}
      enabled={enabled}
      settings={settings}
    />
  );
}

export interface LayerAircraftProps extends CommonLayerProps {
  pointSize?: number;
  color?: string;
  showOnGround?: boolean;
  maxAircraft?: number;
  endpoint?: string;
}

export function LayerAircraft({ enabled, ...settings }: LayerAircraftProps) {
  return (
    <Layer
      manifest={() => import('@earthos/plugin-aircraft')}
      enabled={enabled}
      settings={settings}
    />
  );
}

export interface LayerImageryProps extends CommonLayerProps {
  source?: 'esri' | 'eox' | 'custom';
  template?: string;
  maxZoom?: number;
}

export function LayerImagery({ enabled, ...settings }: LayerImageryProps) {
  return (
    <Layer
      manifest={() => import('@earthos/plugin-imagery')}
      enabled={enabled}
      settings={settings}
    />
  );
}
