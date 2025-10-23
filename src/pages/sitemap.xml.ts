import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';

export const GET: APIRoute = async ({ site }) => {
  const allGigs = await getCollection('gigs');
  const allPress = await getCollection('press');
  const allDaily = await getCollection('daily');

  const pages = [
    '/',
    '/gigs',
    '/press',
    '/daily',
  ];

  // Add dynamic pages
  allGigs.forEach(gig => {
    pages.push(`/gigs/${gig.slug}`);
  });

  allPress.forEach(press => {
    pages.push(`/press/${press.slug}`);
  });

  allDaily.forEach(daily => {
    pages.push(`/daily/${daily.slug}`);
  });

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  ${pages
    .map(page => {
      const url = new URL(page, site);
      return `  <url>
    <loc>${url}</loc>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>`;
    })
    .join('\n')}
</urlset>`;

  return new Response(sitemap, {
    headers: {
      'Content-Type': 'application/xml',
    },
  });
};
