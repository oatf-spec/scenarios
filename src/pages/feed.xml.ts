import type { APIRoute } from 'astro';
import fs from 'node:fs';
import path from 'node:path';

interface ScenarioIndex {
  id: string;
  name: string;
  description: string;
  severity_level: string;
  protocols: string[];
  created: string;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export const GET: APIRoute = () => {
  const indexPath = path.resolve('public/library/index.json');
  const scenarios = JSON.parse(fs.readFileSync(indexPath, 'utf-8')) as ScenarioIndex[];

  const sorted = [...scenarios].sort((a, b) => (b.created || '').localeCompare(a.created || ''));

  const items = sorted.map(s => {
    const link = `https://oatf.dev/${s.id}/`;
    const sevLabel = s.severity_level.charAt(0).toUpperCase() + s.severity_level.slice(1);
    const desc = `${sevLabel} severity ${s.protocols.join('/')} attack: ${escapeXml(s.description.replace(/\n/g, ' '))}`;
    const pubDate = s.created ? new Date(s.created + 'T00:00:00Z').toUTCString() : '';
    return `    <item>
      <title>${escapeXml(s.id)}: ${escapeXml(s.name)}</title>
      <link>${link}</link>
      <guid isPermaLink="true">${link}</guid>${pubDate ? `\n      <pubDate>${pubDate}</pubDate>` : ''}
      <description>${desc}</description>
      <category>${escapeXml(sevLabel)}</category>
    </item>`;
  }).join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>OATF Scenarios</title>
    <link>https://oatf.dev/</link>
    <description>Security threat scenarios for AI agent protocols</description>
    <language>en</language>
    <atom:link href="https://oatf.dev/feed.xml" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
};
