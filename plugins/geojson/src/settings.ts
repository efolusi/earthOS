import { defineSettings, f } from '@earthos/core';

export const settings = defineSettings({
  version: 1,
  fields: {
    url: f.text({
      label: 'GeoJSON URL',
      description: 'Any FeatureCollection URL. Blank shows the bundled sample.',
      placeholder: 'https://example.com/data.geojson',
      default: '',
    }),
    color: f.color({ label: 'Color', default: '#5FB86E' }),
    pointSize: f.number({ label: 'Point size', min: 1, max: 12, default: 5, unit: 'px' }),
    altitudeKm: f.number({
      label: 'Altitude offset',
      description: 'Draw height above the surface',
      min: 0,
      max: 500,
      default: 8,
      unit: 'km',
    }),
  },
});

export default settings;
