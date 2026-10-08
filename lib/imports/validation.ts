import { z } from "zod";
import { normalizeContentUrl, normalizeKeyword } from "@/lib/content/normalize";

export const csvMappingSchema = z.object({
  url: z.string().min(1),
  title: z.string().optional(),
  description: z.string().optional(),
  publishedAt: z.string().optional(),
  keywords: z.string().optional(),
  country: z.string().optional(),
  language: z.string().optional(),
  device: z.string().optional(),
  publicationStatus: z.string().optional(),
}).strict();

export type CsvMapping = z.infer<typeof csvMappingSchema>;

const publicationStatuses = new Set(["DRAFT", "PUBLISHED", "UNPUBLISHED", "REMOVED", "UNKNOWN"]);

export interface ValidatedImportRow {
  normalized: ReturnType<typeof normalizeContentUrl>;
  title?: string;
  description?: string;
  publishedAt?: string;
  keywords: string[];
  countryCode: string;
  languageCode: string;
  device: "DESKTOP" | "MOBILE";
  publicationStatus: "DRAFT" | "PUBLISHED" | "UNPUBLISHED" | "REMOVED" | "UNKNOWN";
}

export function validateImportRow(row: Record<string, string>, mapping: CsvMapping, defaults: { country: string; language: string; device: "DESKTOP" | "MOBILE" }): ValidatedImportRow {
  const value = (column?: string) => column ? (row[column] ?? "").trim() : "";
  const normalized = normalizeContentUrl(value(mapping.url));
  const countryCode = (value(mapping.country) || defaults.country).toUpperCase();
  const languageCode = (value(mapping.language) || defaults.language).toLowerCase();
  const deviceValue = (value(mapping.device) || defaults.device).toUpperCase();
  const statusValue = (value(mapping.publicationStatus) || "UNKNOWN").toUpperCase();
  const publishedAt = value(mapping.publishedAt);

  if (!/^[A-Z]{2}$/.test(countryCode)) throw new Error("Country must be a two-letter code");
  if (!/^[a-z]{2,3}(?:-[a-z0-9]{2,8})?$/.test(languageCode)) throw new Error("Language code is invalid");
  if (deviceValue !== "DESKTOP" && deviceValue !== "MOBILE") throw new Error("Device must be desktop or mobile");
  if (!publicationStatuses.has(statusValue)) throw new Error("Publication status is invalid");
  if (publishedAt && Number.isNaN(Date.parse(publishedAt))) throw new Error("Publication date is invalid");

  return {
    normalized,
    title: value(mapping.title).slice(0, 500) || undefined,
    description: value(mapping.description).slice(0, 5000) || undefined,
    publishedAt: publishedAt || undefined,
    keywords: value(mapping.keywords).split(/[|;]/).map(normalizeKeyword).filter(Boolean).slice(0, 50),
    countryCode,
    languageCode,
    device: deviceValue,
    publicationStatus: statusValue as ValidatedImportRow["publicationStatus"],
  };
}
