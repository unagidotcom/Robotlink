import { describe, expect, it } from "vitest";
import { normalizeContentUrl } from "@/lib/content/normalize";

describe("content URL normalization", () => {
  it.each([
    ["https://instagram.com/p/AbC123/?utm_source=test#fragment", "https://www.instagram.com/p/AbC123/", "POST"],
    ["http://www.instagram.com/reels/XyZ987/?igsh=abc", "https://www.instagram.com/reel/XyZ987/", "REEL"],
    ["https://www.instagram.com/reel/XyZ987/", "https://www.instagram.com/reel/XyZ987/", "REEL"],
  ])("normalizes Instagram %s", (input, expected, contentType) => {
    expect(normalizeContentUrl(input)).toMatchObject({ normalizedUrl: expected, platform: "INSTAGRAM", contentType });
  });

  it("preserves meaningful generic query strings but removes fragments", () => {
    expect(normalizeContentUrl("https://EXAMPLE.com:443/story?id=42#section").normalizedUrl).toBe("https://example.com/story?id=42");
  });

  it("creates identical client dedupe material for equivalent Instagram URLs", () => {
    const first = normalizeContentUrl("https://instagram.com/p/ABC/?utm_source=x");
    const second = normalizeContentUrl("https://www.instagram.com/p/ABC/");
    expect(first.dedupeHash).toBe(second.dedupeHash);
  });
});
