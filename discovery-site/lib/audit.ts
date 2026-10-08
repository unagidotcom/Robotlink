import { getApprovedStories } from "@/lib/content";

export type AuditEntry = Readonly<{
  id: string;
  occurredAt: string;
  action: "EDITORIAL_APPROVED" | "PUBLISHED";
  storySlug: string;
  actor: string;
  note: string;
}>;

export function getPublicAuditLog(): readonly AuditEntry[] {
  return getApprovedStories()
    .flatMap((story) => [
      {
        id: `${story.slug}-approved`,
        occurredAt: story.approvedAt!,
        action: "EDITORIAL_APPROVED" as const,
        storySlug: story.slug,
        actor: story.approvedBy!,
        note: "Summary and outbound source link approved for publication.",
      },
      {
        id: `${story.slug}-published`,
        occurredAt: story.publishedAt,
        action: "PUBLISHED" as const,
        storySlug: story.slug,
        actor: "Site publisher",
        note: "Approved story published to the discovery site.",
      },
    ])
    .sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt));
}
