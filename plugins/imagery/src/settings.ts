import { defineSettings, f } from '@earthos/core';

export const settings = defineSettings({
  version: 1,
  fields: {
    source: f.select({
      label: 'Imagery source',
      options: [
        { value: 'esri', label: 'Esri World Imagery' },
        { value: 'eox', label: 'EOX Sentinel-2 cloudless' },
        { value: 'custom', label: 'Custom template' },
      ],
      default: 'esri',
    }),
    template: f.text({
      label: 'Custom tile template',
      description: 'Used when source is custom: {z}/{x}/{y} placeholders',
      placeholder: 'https://tiles.example.com/{z}/{x}/{y}.jpg',
      default: '',
    }),
    maxZoom: f.number({ label: 'Max zoom', min: 6, max: 15, default: 12 }),
  },
});

export default settings;
