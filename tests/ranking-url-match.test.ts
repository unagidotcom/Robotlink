import { describe, expect, it } from "vitest";
import { matchRankingUrl } from "@/lib/ranking/url-match";
describe("ranking URL matching", () => {
  it("distinguishes exact, normalized, verified, and unrelated URLs", () => {
    expect(matchRankingUrl("https://example.com/a", "https://example.com/a")).toBe("EXACT");
    expect(matchRankingUrl("http://www.example.com/a/", "https://example.com/a?utm_source=x")).toBe("VERIFIED_EQUIVALENT");
    expect(matchRankingUrl("https://example.com/a", "https://other.example/b", ["https://other.example/b"])).toBe("VERIFIED_EQUIVALENT");
    expect(matchRankingUrl("https://example.com/a", "https://example.com/b")).toBe("NO_MATCH");
  });
  it("normalizes Instagram post and Reel forms without matching unrelated posts", () => {
    expect(matchRankingUrl("https://www.instagram.com/reels/ABC/", "https://instagram.com/reel/ABC?igshid=x")).toBe("VERIFIED_EQUIVALENT");
    expect(matchRankingUrl("https://instagram.com/p/ABC", "https://instagram.com/p/XYZ")).toBe("NO_MATCH");
  });
});
