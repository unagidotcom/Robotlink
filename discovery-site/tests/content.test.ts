import { describe, expect, it } from "vitest";
import { getApprovedStories, getApprovedStory, topics } from "@/lib/content";
import sitemap from "@/app/sitemap";
import robots from "@/app/robots";
import { GET as getFeed } from "@/app/feed.xml/route";
import { validateSiteUrl } from "@/lib/site";

describe("editorial publication boundary", () => {
  it("exposes approved stories only", () => {
    expect(getApprovedStories()).toHaveLength(3);
    expect(getApprovedStory("draft-goa-estuary-notes")).toBeUndefined();
  });

  it("requires approval evidence on every public story", () => {
    for (const story of getApprovedStories()) {
      expect(story.approvedAt).toBeTruthy();
      expect(story.approvedBy).toBeTruthy();
      expect(new URL(story.sourceUrl).protocol).toBe("https:");
      expect(story.summary.join(" ").split(/\s+/).length).toBeGreaterThan(120);
    }
  });

  it("rejects local, placeholder, and insecure production origins", () => {
    expect(() => validateSiteUrl("http://localhost:3001", true)).toThrow();
    expect(() => validateSiteUrl("https://travel.example", true)).toThrow();
    expect(() => validateSiteUrl("http://travel.example.org", true)).toThrow();
    expect(validateSiteUrl("https://travel.example.org/path", true).toString()).toBe(
      "https://travel.example.org/",
    );
  });
});

describe("SEO surfaces", () => {
  it("includes only discovery-site URLs in the sitemap", () => {
    const urls = sitemap().map((entry) => new URL(entry.url));
    expect(urls).toHaveLength(3 + topics.length + getApprovedStories().length);
    expect(new Set(urls.map((url) => url.origin))).toEqual(new Set(["http://localhost:3001"]));
    expect(urls.some((url) => url.pathname.includes("draft-goa"))).toBe(false);
  });

  it("provides unique slugs and canonical paths", () => {
    const slugs = getApprovedStories().map((story) => story.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("publishes a crawlable robots policy pointing to the owned sitemap", () => {
    const policy = robots();
    expect(policy.rules).toEqual({ userAgent: "*", allow: "/" });
    expect(policy.sitemap).toBe("http://localhost:3001/sitemap.xml");
  });

  it("keeps drafts and external targets out of the RSS feed", async () => {
    const response = getFeed();
    const xml = await response.text();
    expect(response.headers.get("content-type")).toContain("application/rss+xml");
    expect(xml).not.toContain("draft-goa-estuary-notes");
    for (const story of getApprovedStories()) {
      expect(xml).toContain(`http://localhost:3001/stories/${story.slug}`);
      expect(xml).not.toContain(story.sourceUrl);
    }
  });
});
