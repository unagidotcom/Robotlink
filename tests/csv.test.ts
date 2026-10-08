import { describe, expect, it } from "vitest";
import { buildCsv, parseCsv } from "@/lib/imports/csv";
import { validateImportRow } from "@/lib/imports/validation";

describe("CSV ingestion", () => {
  it("parses quoted commas, escaped quotes, and newlines", () => {
    const document = parseCsv('url,title,keywords\r\n"https://example.com/a","A, story","seo; writing"\r\n"https://example.com/b","She said ""hello""",test');
    expect(document.rows).toHaveLength(2);
    expect(document.rows[0]?.title).toBe("A, story");
    expect(document.rows[1]?.title).toBe('She said "hello"');
  });

  it("validates mapped content without manufacturing evidence statuses", () => {
    const row = validateImportRow({ Link: "https://medium.com/@a/story-1", Terms: "SEO; Growth" }, { url: "Link", keywords: "Terms" }, { country: "IN", language: "en", device: "MOBILE" });
    expect(row.normalized.platform).toBe("MEDIUM");
    expect(row.keywords).toEqual(["seo", "growth"]);
    expect(row).not.toHaveProperty("indexingEvidence");
  });

  it("rejects duplicate and empty headers", () => {
    expect(() => parseCsv("url,url\na,b")).toThrow(/duplicate headers/);
    expect(() => parseCsv("url,\na,b")).toThrow(/empty header/);
  });

  it("neutralizes spreadsheet formulas in reports", () => {
    expect(buildCsv([["=HYPERLINK(\"bad\")"]])).toBe('"\'=HYPERLINK(""bad"")"');
  });
});
