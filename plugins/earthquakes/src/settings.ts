import { defineSettings, f } from '@earthos/core';

export const settings = defineSettings({
  version: 1,
  fields: {
    feed: f.select({
      label: 'Time window',
      options: [
        { value: 'all_hour', label: 'Past hour' },
        { value: 'all_day', label: 'Past day' },
        { value: 'all_week', label: 'Past week' },
        { value: 'all_month', label: 'Past month' },
      ],
      default: 'all_day',
    }),
    minMagnitude: f.number({ label: 'Min magnitude', min: 0, max: 8, step: 0.5, default: 2.5 }),
    endpoint: f.text({
      label: 'Endpoint override',
      description: 'Custom USGS proxy base URL (blank = direct)',
      default: '',
    }),
  },
});

export default settings;
