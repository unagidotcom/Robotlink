import { describe, expect, it } from "vitest";
import { inspectionKey, retryDelay } from "@/lib/inspection/queue";

describe("inspection queue helpers", () => {
  it("deduplicates the same content and URL within a scheduling bucket", () => {
    expect(inspectionKey("content", "https://example.com", 1)).toBe(inspectionKey("content", "https://example.com", 1));
    expect(inspectionKey("content", "https://example.com", 1)).not.toBe(inspectionKey("content", "https://example.com", 2));
  });
  it("uses bounded exponential backoff", () => {
    expect(retryDelay(1)).toBe(5_000); expect(retryDelay(2)).toBe(10_000); expect(retryDelay(99)).toBe(300_000);
  });
});
