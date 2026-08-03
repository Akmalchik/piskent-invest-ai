import type { MetadataRoute } from 'next';

const baseUrl = 'https://www.piskentinvest.uz';
const lastModified = new Date('2026-08-03');

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${baseUrl}/`, lastModified, priority: 1 },
    { url: `${baseUrl}/?tab=map`, lastModified, priority: 0.9 },
    { url: `${baseUrl}/?tab=ai`, lastModified, priority: 0.8 },
    { url: `${baseUrl}/?tab=about`, lastModified, priority: 0.7 },
  ];
}
