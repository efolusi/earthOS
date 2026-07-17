import { defineSettings, f } from '@earthos/core';

export const settings = defineSettings({
  version: 1,
  fields: {
    color: f.color({ label: 'Color', default: '#DFB585' }),
    pointSize: f.number({ label: 'Point size', min: 2, max: 12, default: 6, unit: 'px' }),
  },
});

export default settings;
