import { defineSettings, f } from '@earthos/core';

export const settings = defineSettings({
  version: 1,
  fields: {
    pointSize: f.number({ label: 'Point size', min: 1, max: 10, default: 3.5, unit: 'px' }),
    color: f.color({ label: 'Color', default: '#DFB585' }),
    showOnGround: f.boolean({
      label: 'Include grounded aircraft',
      default: false,
    }),
    maxAircraft: f.number({ label: 'Max aircraft', min: 500, max: 30000, default: 20000 }),
    endpoint: f.text({
      label: 'Endpoint override',
      description: 'OpenSky proxy base URL (blank = direct anonymous access)',
      placeholder: 'https://your-proxy/states/all',
      default: '',
    }),
  },
});

export default settings;
