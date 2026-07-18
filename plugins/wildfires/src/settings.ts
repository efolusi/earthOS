import { defineSettings, f } from '@earthos/core';

export const settings = defineSettings({
  version: 1,
  fields: {
    status: f.select({
      label: 'Events',
      description: 'Currently-burning fires, or include recently-closed ones',
      options: [
        { value: 'open', label: 'Active only' },
        { value: 'all', label: 'Active + recently closed' },
      ],
      default: 'open',
    }),
    days: f.number({
      label: 'Look back (days)',
      description: 'Only events with a detection in this window',
      min: 1,
      max: 60,
      default: 10,
    }),
    pointSize: f.number({ label: 'Point size', min: 2, max: 16, default: 7, unit: 'px' }),
    color: f.color({ label: 'Color', default: '#FF8A1E' }),
    endpoint: f.text({
      label: 'Endpoint override',
      description: 'Custom EONET base URL (blank = direct)',
      default: '',
    }),
  },
});

export default settings;
