import { defineSettings, f } from '@earthos/core';

export const settings = defineSettings({
  version: 1,
  fields: {
    dataSource: f.select({
      label: 'Data source',
      description: 'airplanes.live is keyless and browser-direct; OpenSky needs a proxy',
      options: [
        { value: 'airplaneslive', label: 'airplanes.live (viewport)' },
        { value: 'opensky', label: 'OpenSky Network (global)' },
      ],
      default: 'airplaneslive',
    }),
    pointSize: f.number({ label: 'Point size', min: 1, max: 12, default: 6, unit: 'px' }),
    color: f.color({ label: 'Color', default: '#DFB585' }),
    showOnGround: f.boolean({
      label: 'Include grounded aircraft',
      default: false,
    }),
    maxAircraft: f.number({ label: 'Max aircraft', min: 500, max: 30000, default: 20000 }),
    endpoint: f.text({
      label: 'Endpoint override',
      description: 'Custom base URL for the selected source (blank = default)',
      placeholder: 'https://your-proxy/v2/point',
      default: '',
    }),
  },
});

export default settings;
