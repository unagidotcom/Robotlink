"use server";

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { requirePermission } from "@/lib/auth/authorization";
import { requireViewer } from "@/lib/dal/viewer";
import { classifyDiscoveryEligibility } from "@/lib/discovery/classification";
import { prepareEditorialReference, verifyEditorialFingerprint } from "@/lib/discovery/editorial";
import { campaignInputSchema, campaignItemInputSchema, candidateReviewSchema } from "@/lib/discovery/validation";
import { prisma } from "@/lib/prisma";

function fields(formData: FormData): Record<string, string> {
  return Object.fromEntries([...formData.entries()].filter(([, value]) => typeof value === "string")) as Record<string, string>;
}

export async function createDiscoveryCampaignAction(formData: FormData): Promise<void> {
  const parsed = campaignInputSchema.parse(fields(formData));
  const viewer = await requireViewer(parsed.agencyId);
  requirePermission(viewer.role, "discovery:write");
  const client = await prisma.client.findFirst({ where: { id: parsed.clientId, agencyId: viewer.agencyId, active: true }, select: { id: true } });
  if (!client) throw new Error("CLIENT_NOT_FOUND");
  const campaign = await prisma.discoveryCampaign.create({ data: { agencyId: viewer.agencyId, clientId: client.id, name: parsed.name, method: parsed.method, createdById: viewer.userId } });
  await prisma.auditEvent.create({ data: { agencyId: viewer.agencyId, actorType: "USER", actorUserId: viewer.userId, action: "discovery.campaign_created", targetType: "discovery_campaign", targetId: campaign.id, sanitizedData: { method: campaign.method } } });
  redirect(`/discovery/${campaign.id}`);
}

export async function addDiscoveryCampaignItemAction(formData: FormData): Promise<void> {
  const parsed = campaignItemInputSchema.parse(fields(formData));
  const viewer = await requireViewer(parsed.agencyId);
  requirePermission(viewer.role, "discovery:write");
  const campaign = await prisma.discoveryCampaign.findFirst({ where: { id: parsed.campaignId, agencyId: viewer.agencyId }, select: { id: true, clientId: true, status: true } });
  if (!campaign || campaign.status === "CANCELLED" || campaign.status === "COMPLETED") throw new Error("CAMPAIGN_NOT_AVAILABLE");
  const content = await prisma.content.findFirst({
    where: { id: parsed.contentId, agencyId: viewer.agencyId, clientId: campaign.clientId, archivedAt: null },
    include: {
      publisherAccount: { select: { authorizationStatus: true } },
      permissions: { where: { status: "ALLOWED" }, select: { capabilityCode: true } },
      inspections: { orderBy: { inspectedAt: "desc" }, take: 1, select: { outcome: true } },
    },
  });
  if (!content) throw new Error("CONTENT_NOT_FOUND");
  const editable = content.permissions.some((permission) => ["edit_content", "edit_caption", "edit_metadata", "publish"].includes(permission.capabilityCode));
  const classification = classifyDiscoveryEligibility({ technicalStatus: content.technicalStatus, inspectionOutcome: content.inspections[0]?.outcome, publisherAuthorized: content.publisherAccount?.authorizationStatus === "ALLOWED", editable });
  try {
    const item = await prisma.$transaction(async (tx) => {
      const created = await tx.discoveryCampaignItem.create({ data: { agencyId: viewer.agencyId, clientId: campaign.clientId, campaignId: campaign.id, contentId: content.id, eligibility: classification.eligibility, eligibilityReason: classification.reason, workflowStatus: classification.workflowStatus } });
      await tx.discoveryCampaign.update({ where: { id: campaign.id }, data: { status: "ACTIVE", startedAt: new Date() } });
      await tx.statusHistory.create({ data: { agencyId: viewer.agencyId, entityType: "discovery_item", entityId: created.id, statusDimension: "discovery_workflow", newValue: created.workflowStatus, reason: classification.reason, actorType: "USER", actorId: viewer.userId } });
      await tx.auditEvent.create({ data: { agencyId: viewer.agencyId, actorType: "USER", actorUserId: viewer.userId, action: "discovery.item_added", targetType: "discovery_item", targetId: created.id, sanitizedData: { eligibility: created.eligibility } } });
      return created;
    });
    revalidatePath(`/discovery/${campaign.id}`);
    redirect(`/discovery/${campaign.id}#item-${item.id}`);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new Error("CONTENT_ALREADY_IN_CAMPAIGN");
    throw error;
  }
}

export async function prepareEditorialCandidateAction(campaignItemId: string, agencyId: string): Promise<void> {
  const viewer = await requireViewer(agencyId);
  requirePermission(viewer.role, "discovery:write");
  const item = await prisma.discoveryCampaignItem.findFirst({
    where: { id: campaignItemId, agencyId: viewer.agencyId, eligibility: { in: ["THIRD_PARTY_URL", "OWNED_AUTHORIZED_URL"] } },
    include: { editorialCandidate: { select: { id: true } }, content: { include: { publisherAccount: { select: { displayName: true } }, inspections: { where: { outcome: "ACCESSIBLE" }, orderBy: { inspectedAt: "desc" }, take: 1 } } } },
  });
  if (!item) throw new Error("DISCOVERY_ITEM_NOT_ELIGIBLE");
  if (item.editorialCandidate) { revalidatePath(`/discovery/${item.campaignId}`); return; }
  const inspection = item.content.inspections[0];
  if (!inspection?.title) throw new Error("VERIFIED_SOURCE_TITLE_REQUIRED");
  const draft = prepareEditorialReference({ url: item.content.originalUrl, title: inspection.title, description: inspection.metaDescription, publisher: item.content.publisherAccount?.displayName, inspectedAt: inspection.inspectedAt });
  const referenceKey = createHash("sha256").update(`${viewer.agencyId}:${item.contentId}`).digest("hex");
  if (await prisma.editorialCandidate.findUnique({ where: { referenceKey }, select: { id: true } })) throw new Error("EDITORIAL_REFERENCE_ALREADY_EXISTS");
  await prisma.$transaction(async (tx) => {
    await tx.editorialCandidate.create({ data: { campaignItemId: item.id, referenceKey, sourceUrl: item.content.originalUrl, sourceInspectedAt: inspection.inspectedAt, preparedById: viewer.userId, ...draft } });
    await tx.discoveryCampaignItem.update({ where: { id: item.id }, data: { workflowStatus: "DRAFT_PREPARED", reviewStatus: "PENDING" } });
    await tx.statusHistory.create({ data: { agencyId: viewer.agencyId, entityType: "discovery_item", entityId: item.id, statusDimension: "discovery_workflow", previousValue: item.workflowStatus, newValue: "DRAFT_PREPARED", reason: "Draft prepared from the latest verified inspection metadata", actorType: "USER", actorId: viewer.userId } });
    await tx.auditEvent.create({ data: { agencyId: viewer.agencyId, actorType: "USER", actorUserId: viewer.userId, action: "discovery.draft_prepared", targetType: "discovery_item", targetId: item.id, sanitizedData: { sourceInspectedAt: inspection.inspectedAt.toISOString() } } });
  });
  revalidatePath(`/discovery/${item.campaignId}`);
}

export async function refreshDiscoveryEligibilityAction(campaignItemId: string, agencyId: string): Promise<void> {
  const viewer = await requireViewer(agencyId);
  requirePermission(viewer.role, "discovery:write");
  const item = await prisma.discoveryCampaignItem.findFirst({
    where: { id: campaignItemId, agencyId: viewer.agencyId, workflowStatus: { in: ["AWAITING_INSPECTION", "ELIGIBLE_FOR_EDITORIAL_REVIEW"] } },
    include: { content: { include: { publisherAccount: { select: { authorizationStatus: true } }, permissions: { where: { status: "ALLOWED" }, select: { capabilityCode: true } }, inspections: { orderBy: { inspectedAt: "desc" }, take: 1, select: { outcome: true } } } } },
  });
  if (!item) throw new Error("DISCOVERY_ITEM_NOT_REFRESHABLE");
  const editable = item.content.permissions.some((permission) => ["edit_content", "edit_caption", "edit_metadata", "publish"].includes(permission.capabilityCode));
  const classification = classifyDiscoveryEligibility({ technicalStatus: item.content.technicalStatus, inspectionOutcome: item.content.inspections[0]?.outcome, publisherAuthorized: item.content.publisherAccount?.authorizationStatus === "ALLOWED", editable });
  await prisma.$transaction(async (tx) => {
    await tx.discoveryCampaignItem.update({ where: { id: item.id }, data: { eligibility: classification.eligibility, eligibilityReason: classification.reason, workflowStatus: classification.workflowStatus } });
    if (item.eligibility !== classification.eligibility || item.workflowStatus !== classification.workflowStatus) await tx.statusHistory.create({ data: { agencyId: viewer.agencyId, entityType: "discovery_item", entityId: item.id, statusDimension: "discovery_eligibility", previousValue: `${item.eligibility}:${item.workflowStatus}`, newValue: `${classification.eligibility}:${classification.workflowStatus}`, reason: classification.reason, actorType: "USER", actorId: viewer.userId } });
    await tx.auditEvent.create({ data: { agencyId: viewer.agencyId, actorType: "USER", actorUserId: viewer.userId, action: "discovery.eligibility_refreshed", targetType: "discovery_item", targetId: item.id, sanitizedData: { eligibility: classification.eligibility } } });
  });
  revalidatePath(`/discovery/${item.campaignId}`);
}

export async function reviewEditorialCandidateAction(formData: FormData): Promise<void> {
  const parsed = candidateReviewSchema.parse(fields(formData));
  const viewer = await requireViewer(parsed.agencyId);
  requirePermission(viewer.role, "discovery:write");
  const item = await prisma.discoveryCampaignItem.findFirst({ where: { id: parsed.campaignItemId, agencyId: viewer.agencyId }, include: { editorialCandidate: true } });
  if (!item?.editorialCandidate) throw new Error("EDITORIAL_CANDIDATE_NOT_FOUND");
  if (!verifyEditorialFingerprint(item.editorialCandidate)) throw new Error("EDITORIAL_DRAFT_INTEGRITY_FAILED");
  const approved = parsed.decision === "APPROVED";
  const nextWorkflow = approved ? "APPROVED" : "DRAFT_PREPARED";
  await prisma.$transaction(async (tx) => {
    await tx.editorialCandidate.update({ where: { id: item.editorialCandidate!.id }, data: { reviewedById: viewer.userId, reviewedAt: new Date(), reviewNote: parsed.reviewNote || null } });
    await tx.discoveryCampaignItem.update({ where: { id: item.id }, data: { reviewStatus: parsed.decision, workflowStatus: nextWorkflow, approvedAt: approved ? new Date() : null } });
    await tx.statusHistory.create({ data: { agencyId: viewer.agencyId, entityType: "discovery_item", entityId: item.id, statusDimension: "editorial_review", previousValue: item.reviewStatus, newValue: parsed.decision, reason: parsed.reviewNote || "Human editorial review", actorType: "USER", actorId: viewer.userId } });
    await tx.auditEvent.create({ data: { agencyId: viewer.agencyId, actorType: "USER", actorUserId: viewer.userId, action: `discovery.review_${parsed.decision.toLowerCase()}`, targetType: "discovery_item", targetId: item.id } });
  });
  revalidatePath(`/discovery/${item.campaignId}`);
}
