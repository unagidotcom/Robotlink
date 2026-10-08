import { z } from "zod";

const optionalUuid = z.union([z.string().uuid(), z.literal("")]).transform((value) => value || undefined);

export const contentInputSchema = z.object({
  agencyId: z.string().uuid(),
  clientId: z.string().uuid(),
  originalUrl: z.string().trim().url().max(4096),
  title: z.string().trim().max(500).optional().default(""),
  description: z.string().trim().max(5000).optional().default(""),
  publishedAt: z.union([z.string().date(), z.literal("")]).optional().default(""),
  publisherAccountId: optionalUuid.optional(),
  keywords: z.string().max(5000).optional().default(""),
  countryCode: z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/),
  languageCode: z.string().trim().toLowerCase().regex(/^[a-z]{2,3}(?:-[a-z0-9]{2,8})?$/),
  device: z.enum(["DESKTOP", "MOBILE"]),
  publicationStatus: z.enum(["DRAFT", "PUBLISHED", "UNPUBLISHED", "REMOVED", "UNKNOWN"]),
}).strict();

export const clientInputSchema = z.object({
  agencyId: z.string().uuid(),
  name: z.string().trim().min(2).max(160),
  externalReference: z.string().trim().max(160).optional().default(""),
  defaultCountryCode: z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/),
  defaultLanguageCode: z.string().trim().toLowerCase().regex(/^[a-z]{2,3}(?:-[a-z0-9]{2,8})?$/),
  defaultDevice: z.enum(["DESKTOP", "MOBILE"]),
}).strict();

export type ContentInput = z.infer<typeof contentInputSchema>;
