import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: ['/', '/about', '/features', '/help', '/terms', '/privacy', '/legal'],
      disallow: ['/dashboard/', '/admin/', '/api/'],
    },
    sitemap: 'https://foodlabel.lucke.jp/sitemap.xml',
  };
}
