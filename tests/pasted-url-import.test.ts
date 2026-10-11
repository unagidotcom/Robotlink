import { describe, expect, it } from "vitest";
import { MAX_PASTED_URLS } from "@/lib/imports/constants";
import { buildPreviewRows, parsePastedUrls } from "@/lib/imports/preview";
import { csvMappingSchema } from "@/lib/imports/validation";
import { getInspectionConfig } from "@/lib/inspection/config";

const mapping = csvMappingSchema.parse({ url: "url" });
const defaults = { country: "US", language: "en", device: "DESKTOP" as const };

function preview(value: string, existingHashes: ReadonlySet<string> = new Set()) {
  return buildPreviewRows(parsePastedUrls(value), mapping, defaults, existingHashes);
}

describe("pasted URL imports", () => {
  it("accepts one URL and keeps evidence-dependent fields at their import defaults", () => {
    const rows = preview("https://example.com/article");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ rowNumber: 1, status: "VALID", rejectionReason: null });
    expect(rows[0]?.normalizedData).toMatchObject({ publicationStatus: "UNKNOWN" });
  });

  it.each([10, 100])("accepts a batch of %i URLs", (count) => {
    const rows = preview(Array.from({ length: count }, (_, index) => `https://example.com/article-${index + 1}`).join("\n"));
    expect(rows).toHaveLength(count);
    expect(rows.every((row) => row.status === "VALID")).toBe(true);
  });

  it("trims values, ignores blank lines, and retains source line numbers", () => {
    expect(parsePastedUrls("  https://example.com/one  \n\n https://example.com/two\n")).toEqual([
      { rowNumber: 1, rawData: { url: "https://example.com/one" } },
      { rowNumber: 3, rawData: { url: "https://example.com/two" } },
    ]);
  });

  it("rejects empty and oversized batches", () => {
    expect(() => parsePastedUrls(" \n\n ")).toThrow("Enter at least one URL");
    const oversized = Array.from({ length: MAX_PASTED_URLS + 1 }, (_, index) => `https://example.com/${index}`).join("\n");
    expect(() => parsePastedUrls(oversized)).toThrow(`limited to ${MAX_PASTED_URLS}`);
  });

  it("reports malformed and unsupported URLs per row", () => {
    const rows = preview("not-a-url\nftp://example.com/file\nhttps://example.com/good");
    expect(rows.map((row) => row.status)).toEqual(["REJECTED", "REJECTED", "VALID"]);
    expect(rows[0]?.rejectionReason).toBeTruthy();
    expect(rows[1]?.rejectionReason).toBeTruthy();
  });

  it("marks normalized duplicates within a batch", () => {
    const rows = preview("https://example.com/article\n  https://example.com/article  ");
    expect(rows.map((row) => row.status)).toEqual(["VALID", "DUPLICATE"]);
    expect(rows[1]?.rejectionReason).toBe("Duplicate URL within this client");
  });

  it("marks URLs already present for the client as duplicates", () => {
    const first = preview("https://example.com/existing")[0]!;
    const rows = preview("https://example.com/existing\nhttps://example.com/new", new Set([first.dedupeHash!]));
    expect(rows.map((row) => row.status)).toEqual(["DUPLICATE", "VALID"]);
  });

  it("honors automatic inspection scheduling being enabled or disabled", () => {
    expect(getInspectionConfig({ AUTO_INSPECT_CONFIRMED_IMPORTS: "true" }).AUTO_INSPECT_CONFIRMED_IMPORTS).toBe(true);
    expect(getInspectionConfig({ AUTO_INSPECT_CONFIRMED_IMPORTS: "false" }).AUTO_INSPECT_CONFIRMED_IMPORTS).toBe(false);
  });
});
