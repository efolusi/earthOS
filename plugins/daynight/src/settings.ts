import { defineSettings, f } from '@earthos/core';

export const settings = defineSettings({
  version: 1,
  fields: {
    showTerminator: f.boolean({ label: 'Terminator line', default: true }),
    showSubsolar: f.boolean({ label: 'Subsolar marker', default: true }),
    showSublunar: f.boolean({ label: 'Sublunar marker', default: false }),
    lineColor: f.color({ label: 'Line color', default: '#fbbf24' }),
  },
});

export default settings;
