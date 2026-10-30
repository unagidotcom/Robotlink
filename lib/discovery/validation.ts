import { z } from "zod";

export const campaignInputSchema = z.object({
  agencyId: z.string().uuid(),
  clientId: z.string().uuid(),
  name: z.string().trim().min(3).max(200),
  method: z.enum(["EDITORIAL_REFERENCE", "OWNED_CONTENT_HUB", "RSS_ATOM", "PUBLISHER_SUPPORTED", "OTHER"]),
});

export const campaignItemInputSchema = z.object({
  agencyId: z.string().uuid(),
  campaignId: z.string().uuid(),
  contentId: z.string().uuid(),
});

export const candidateReviewSchema = z.object({
  agencyId: z.string().uuid(),
  campaignItemId: z.string().uuid(),
  decision: z.enum(["APPROVED", "REJECTED", "CHANGES_REQUESTED"]),
  reviewNote: z.string().trim().max(1000).optional(),
});
