import type { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: 'https://earthos.efolusi.com',
      changeFrequency: 'daily',
      priority: 1,
    },
  ];
}
