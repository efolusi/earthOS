import { defineSettings, f } from '@earthos/core';

export const settings = defineSettings({
  version: 1,
  fields: {
    endpoint: f.text({
      label: 'Endpoint override',
      description: 'NHC CurrentStorms proxy (blank = direct)',
      default: '',
    }),
  },
});

export default settings;
