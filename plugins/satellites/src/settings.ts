import { defineSettings, f } from '@earthos/core';

export const settings = defineSettings({
  version: 1,
  fields: {
    group: f.select({
      label: 'Catalog group',
      description: 'Which CelesTrak GP group to load',
      options: [
        { value: 'starlink', label: 'Starlink' },
        { value: 'active', label: 'All active satellites' },
        { value: 'stations', label: 'Space stations (ISS, CSS)' },
        { value: 'gps-ops', label: 'GPS constellation' },
        { value: 'oneweb', label: 'OneWeb' },
        { value: 'geo', label: 'Geostationary' },
        { value: 'weather', label: 'Weather satellites' },
        { value: 'science', label: 'Science missions' },
      ],
      default: 'starlink',
    }),
    pointSize: f.number({ label: 'Point size', min: 1, max: 10, default: 3, unit: 'px' }),
    color: f.color({ label: 'Color', default: '#CE9C66' }),
    showOrbit: f.boolean({
      label: 'Orbit line',
      description: 'Draw the orbit path of the selected satellite',
      default: true,
    }),
    maxSatellites: f.number({
      label: 'Max satellites',
      min: 100,
      max: 30000,
      default: 15000,
    }),
    endpoint: f.text({
      label: 'Endpoint override',
      description: 'Custom CelesTrak proxy URL (blank = direct)',
      placeholder: 'https://your-proxy/gp.php',
      default: '',
    }),
  },
});

export default settings;
