import { getApprovedStories } from "@/lib/content";
import { absoluteUrl, siteDescription, siteName } from "@/lib/site";

export const dynamic = "force-static";

function escapeXml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;");
}

export function GET() {
  const items = getApprovedStories().map((story) => `
    <item>
      <title>${escapeXml(story.title)}</title>
      <link>${escapeXml(absoluteUrl(`/stories/${story.slug}`))}</link>
      <guid isPermaLink="true">${escapeXml(absoluteUrl(`/stories/${story.slug}`))}</guid>
      <pubDate>${new Date(story.publishedAt).toUTCString()}</pubDate>
      <description>${escapeXml(story.deck)}</description>
    </item>`).join("");
  const xml = `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0"><channel><title>${escapeXml(siteName)}</title><link>${escapeXml(absoluteUrl("/"))}</link><description>${escapeXml(siteDescription)}</description><language>en</language>${items}
</channel></rss>`;
  return new Response(xml, { headers: { "Content-Type": "application/rss+xml; charset=utf-8", "Cache-Control": "public, max-age=0, s-maxage=3600" } });
}
