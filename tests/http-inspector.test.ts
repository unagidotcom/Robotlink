import { describe, expect, it } from "vitest";
import { getInspectionConfig } from "@/lib/inspection/config";
import { inspectUrl, type PinnedRequester } from "@/lib/inspection/http-inspector";

const config = getInspectionConfig({});
const resolver = async (hostname: string) => [{ address: hostname === "evil.test" ? "93.184.216.35" : "93.184.216.34", family: 4 as const }];

describe("HTTP inspector", () => {
  it("revalidates and pins every redirect destination", async () => {
    const pins: string[] = [];
    const requester: PinnedRequester = async (url, address) => {
      pins.push(`${url.hostname}:${address.address}`);
      if (url.pathname === "/robots.txt") return { status: 404, headers: {}, body: Buffer.alloc(0), url };
      if (url.hostname === "example.com") return { status: 302, headers: { location: "https://evil.test/final" }, body: Buffer.alloc(0), url };
      return { status: 200, headers: { "content-type": "text/html" }, body: Buffer.from("<title>Final</title>"), url };
    };
    const result = await inspectUrl("https://example.com/start", config, { resolver, requester });
    expect(result.finalUrl).toBe("https://evil.test/final");
    expect(result.derivedTechnicalStatus).toBe("REDIRECTED");
    expect(pins).toContain("example.com:93.184.216.34");
    expect(pins).toContain("evil.test:93.184.216.35");
  });
  it("records noindex without claiming indexing state", async () => {
    const requester: PinnedRequester = async (url) => url.pathname === "/robots.txt"
      ? { status: 200, headers: { "content-type": "text/plain" }, body: Buffer.from("User-agent: *\nAllow: /"), url }
      : { status: 200, headers: { "content-type": "text/html", "x-robots-tag": "noindex" }, body: Buffer.from("<title>A</title>"), url };
    const result = await inspectUrl("https://example.com/a", config, { resolver, requester });
    expect(result.derivedTechnicalStatus).toBe("NOINDEX_SIGNAL");
    expect(result.xRobotsTag).toContain("noindex");
    expect(result).not.toHaveProperty("indexingEvidence");
  });
  it("limits PDF inspection to response headers and accessibility", async () => {
    const requester: PinnedRequester = async (url) => url.pathname === "/robots.txt"
      ? { status: 404, headers: {}, body: Buffer.alloc(0), url }
      : { status: 200, headers: { "content-type": "application/pdf" }, body: Buffer.from("%PDF"), url };
    const result = await inspectUrl("https://example.com/file.pdf", config, { resolver, requester });
    expect(result.outcome).toBe("ACCESSIBLE"); expect(result.title).toBeUndefined(); expect(result.rawObservations.pdfHeadersOnly).toBe(true);
  });
});
