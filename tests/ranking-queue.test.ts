import { describe, expect, it } from "vitest";
import { rankingQueryHash } from "@/lib/ranking/queue";
describe("ranking shared request identity", () => {
  it("shares only identical public search configurations", () => {
    const query = { keyword: "example", countryCode: "US", languageCode: "en", device: "DESKTOP", depth: 10, providerCode: "dataforseo" };
    expect(rankingQueryHash(query)).toBe(rankingQueryHash({ ...query }));
    expect(rankingQueryHash(query)).not.toBe(rankingQueryHash({ ...query, device: "MOBILE" }));
    expect(rankingQueryHash(query)).not.toBe(rankingQueryHash({ ...query, depth: 20 }));
  });
});
