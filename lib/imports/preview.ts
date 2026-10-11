import { Prisma } from "@prisma/client";
import { MAX_PASTED_URLS } from "./constants";
import { validateImportRow, type CsvMapping, type ValidatedImportRow } from "./validation";

export interface ImportSourceRow {
  rowNumber: number;
  rawData: Record<string, string>;
}

export type PreviewImportRow = {
  rowNumber: number;
  status: "VALID" | "DUPLICATE" | "REJECTED";
  rawData: Prisma.InputJsonValue;
  normalizedData: Prisma.InputJsonValue | typeof Prisma.JsonNull;
  dedupeHash: string | null;
  rejectionReason: string | null;
};

export function parsePastedUrls(value: string): ImportSourceRow[] {
  const rows = value
    .split(/\r?\n/)
    .map((url, index) => ({ rowNumber: index + 1, url: url.trim() }))
    .filter((row) => row.url.length > 0);

  if (!rows.length) throw new Error("Enter at least one URL");
  if (rows.length > MAX_PASTED_URLS) throw new Error(`Paste is limited to ${MAX_PASTED_URLS} URLs per batch`);

  return rows.map(({ rowNumber, url }) => ({ rowNumber, rawData: { url } }));
}

function importJson(row: ValidatedImportRow): Prisma.InputJsonValue {
  return { ...row, normalized: row.normalized } as unknown as Prisma.InputJsonValue;
}

export function buildPreviewRows(
  sourceRows: ImportSourceRow[],
  mapping: CsvMapping,
  defaults: { country: string; language: string; device: "DESKTOP" | "MOBILE" },
  existingHashes: ReadonlySet<string>,
): PreviewImportRow[] {
  const seen = new Set<string>();

  return sourceRows.map(({ rowNumber, rawData }) => {
    try {
      const normalizedData = validateImportRow(rawData, mapping, defaults);
      const duplicate = existingHashes.has(normalizedData.normalized.dedupeHash) || seen.has(normalizedData.normalized.dedupeHash);
      seen.add(normalizedData.normalized.dedupeHash);
      return {
        rowNumber,
        status: duplicate ? "DUPLICATE" : "VALID",
        rawData: rawData as Prisma.InputJsonValue,
        normalizedData: importJson(normalizedData),
        dedupeHash: normalizedData.normalized.dedupeHash,
        rejectionReason: duplicate ? "Duplicate URL within this client" : null,
      };
    } catch (error) {
      return {
        rowNumber,
        status: "REJECTED",
        rawData: rawData as Prisma.InputJsonValue,
        normalizedData: Prisma.JsonNull,
        dedupeHash: null,
        rejectionReason: error instanceof Error ? error.message : "Invalid row",
      };
    }
  });
}
