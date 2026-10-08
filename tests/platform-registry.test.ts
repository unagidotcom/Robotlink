import { describe, expect, it } from "vitest";
import { identifyPlatform } from "@/platforms/registry";

describe("platform identification", () => {
  it.each([
    ["https://medium.com/@author/article-123", "MEDIUM", "ARTICLE"],
    ["https://www.instagram.com/p/ABC123/", "INSTAGRAM", "POST"],
    ["https://instagram.com/reel/ABC123/", "INSTAGRAM", "REEL"],
    ["https://site.wordpress.com/2026/hello/", "WORDPRESS_COM", "ARTICLE"],
    ["https://site.blogspot.com/2026/01/hello.html", "BLOGGER", "ARTICLE"],
    ["https://writer.substack.com/p/hello", "SUBSTACK", "ARTICLE"],
    ["https://www.linkedin.com/pulse/title-author-id", "LINKEDIN", "ARTICLE"],
    ["https://example.org/report.pdf?download=1", "PUBLIC_PDF", "PDF"],
    ["https://example.org/story", "GENERIC", "OTHER"],
  ])("identifies %s", (url, platform, contentType) => {
    expect(identifyPlatform(url)).toMatchObject({ platform, contentType });
  });

  it("rejects non-web schemes", () => {
    expect(() => identifyPlatform("file:///etc/passwd")).toThrow(/HTTP and HTTPS/);
  });

  it("does not classify an Instagram profile as a post", () => {
    expect(identifyPlatform("https://instagram.com/example").platform).toBe("GENERIC");
  });
});
