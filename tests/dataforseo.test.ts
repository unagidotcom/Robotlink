import { describe, expect, it } from "vitest";
import { DataForSeoProvider, parseDataForSeoResponse } from "@/providers/dataforseo";
const fixture = { tasks: [{ id: "task-1", status_code: 20000, cost: 0.002, result: [{ datetime: "2026-10-08 12:00:00 +00:00", items: [{ type: "organic", rank_absolute: 3, url: "https://example.com/a", title: "A" }, { type: "people_also_ask", rank_absolute: 4 }] }] }] };
describe("DataForSEO adapter", () => {
  it("parses only organic results and provider evidence", () => { const result = parseDataForSeoResponse(fixture); expect(result.results).toEqual([{ position: 3, url: "https://example.com/a", title: "A" }]); expect(result.providerRequestId).toBe("task-1"); expect(result.actualCostMinor).toBe(0n); });
  it("does not execute paid calls unless explicitly enabled", async () => { const provider = new DataForSeoProvider({ enabled: false, estimatedTop10Minor: 1n }); await expect(provider.execute({ keyword: "a", countryCode: "US", languageCode: "en", device: "desktop", depth: 10 }, { agencyId: "a", idempotencyKey: "i", correlationId: "c" })).rejects.toThrow("PAID_PROVIDER_DISABLED"); });
  it("uses depth-based conservative estimates", async () => { const provider = new DataForSeoProvider({ enabled: false, estimatedTop10Minor: 2n }); await expect(provider.estimate({ keyword: "a", countryCode: "US", languageCode: "en", device: "desktop", depth: 21 })).resolves.toMatchObject({ amountMinor: 6n }); });
});
