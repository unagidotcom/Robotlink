import "server-only";
import type { Viewer } from "@/lib/dal/viewer";
import { prisma } from "@/lib/prisma";
import { verifyEditorialFingerprint } from "./editorial";

export type DiscoverySiteCandidate = Readonly<{
  campaignItemId: string;
  sourceUrl: string;
  sourceTitle: string;
  sourcePublisher: string | null;
  referenceDescription: string;
  attributionLabel: string;
  approvedAt: string;
}>;

export async function getApprovedDiscoverySiteCandidate(viewer: Pick<Viewer, "agencyId">, campaignItemId: string): Promise<DiscoverySiteCandidate | null> {
  const item = await prisma.discoveryCampaignItem.findFirst({
    where: { id: campaignItemId, agencyId: viewer.agencyId, workflowStatus: "APPROVED", reviewStatus: "APPROVED", publicationEvidenceStatus: "NOT_PUBLISHED" },
    include: { editorialCandidate: true },
  });
  const candidate = item?.editorialCandidate;
  if (!item || !candidate || !item.approvedAt || !verifyEditorialFingerprint(candidate)) return null;
  return {
    campaignItemId: item.id,
    sourceUrl: candidate.sourceUrl,
    sourceTitle: candidate.sourceTitle,
    sourcePublisher: candidate.sourcePublisher,
    referenceDescription: candidate.draftReference,
    attributionLabel: candidate.attributionLabel,
    approvedAt: item.approvedAt.toISOString(),
  };
}

export function publishDiscoverySiteCandidate(): never {
  throw new Error("DISCOVERY_PUBLICATION_DISABLED_IN_PHASE_D1");
}
