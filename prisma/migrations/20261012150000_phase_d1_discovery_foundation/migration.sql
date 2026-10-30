-- Phase D1: tenant-scoped, human-reviewed editorial discovery foundation.
CREATE TYPE "DiscoveryEligibility" AS ENUM ('UNKNOWN', 'THIRD_PARTY_URL', 'OWNED_AUTHORIZED_URL', 'UNSUPPORTED_OR_RESTRICTED');
CREATE TYPE "DiscoveryMethod" AS ENUM ('EDITORIAL_REFERENCE', 'OWNED_CONTENT_HUB', 'RSS_ATOM', 'PUBLISHER_SUPPORTED', 'OTHER');
CREATE TYPE "DiscoveryCampaignStatus" AS ENUM ('DRAFT', 'ACTIVE', 'COMPLETED', 'CANCELLED');
CREATE TYPE "DiscoveryWorkflowStatus" AS ENUM ('AWAITING_INSPECTION', 'ELIGIBLE_FOR_EDITORIAL_REVIEW', 'DRAFT_PREPARED', 'APPROVED', 'PUBLISHED_REFERENCE', 'MONITORING', 'INDEXING_UNVERIFIED');
CREATE TYPE "EditorialReviewStatus" AS ENUM ('NOT_SUBMITTED', 'PENDING', 'APPROVED', 'REJECTED', 'CHANGES_REQUESTED');
CREATE TYPE "PublicationEvidenceStatus" AS ENUM ('NOT_PUBLISHED', 'PROVIDED', 'VERIFIED', 'REJECTED');

CREATE TABLE "DiscoveryCampaign" (
  "id" UUID NOT NULL,
  "agencyId" UUID NOT NULL,
  "clientId" UUID NOT NULL,
  "name" VARCHAR(200) NOT NULL,
  "method" "DiscoveryMethod" NOT NULL,
  "status" "DiscoveryCampaignStatus" NOT NULL DEFAULT 'DRAFT',
  "createdById" UUID NOT NULL,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DiscoveryCampaign_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DiscoveryCampaignItem" (
  "id" UUID NOT NULL,
  "agencyId" UUID NOT NULL,
  "clientId" UUID NOT NULL,
  "campaignId" UUID NOT NULL,
  "contentId" UUID NOT NULL,
  "eligibility" "DiscoveryEligibility" NOT NULL DEFAULT 'UNKNOWN',
  "eligibilityReason" VARCHAR(500),
  "workflowStatus" "DiscoveryWorkflowStatus" NOT NULL DEFAULT 'AWAITING_INSPECTION',
  "reviewStatus" "EditorialReviewStatus" NOT NULL DEFAULT 'NOT_SUBMITTED',
  "publicationEvidenceStatus" "PublicationEvidenceStatus" NOT NULL DEFAULT 'NOT_PUBLISHED',
  "publicationUrl" TEXT,
  "publicationEvidence" JSONB,
  "approvedAt" TIMESTAMP(3),
  "publishedAt" TIMESTAMP(3),
  "monitoringStartedAt" TIMESTAMP(3),
  "firstSearchAppearanceAt" TIMESTAMP(3),
  "outcomeMeasuredAt" TIMESTAMP(3),
  "outcomeEvidence" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DiscoveryCampaignItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EditorialCandidate" (
  "id" UUID NOT NULL,
  "campaignItemId" UUID NOT NULL,
  "referenceKey" CHAR(64) NOT NULL,
  "sourceUrl" TEXT NOT NULL,
  "sourceTitle" TEXT NOT NULL,
  "sourceDescription" TEXT,
  "sourcePublisher" VARCHAR(500),
  "sourceInspectedAt" TIMESTAMP(3) NOT NULL,
  "draftReference" TEXT NOT NULL,
  "attributionLabel" VARCHAR(500) NOT NULL,
  "supportedClaims" JSONB NOT NULL,
  "draftFingerprint" CHAR(64) NOT NULL,
  "preparedById" UUID NOT NULL,
  "preparedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedById" UUID,
  "reviewedAt" TIMESTAMP(3),
  "reviewNote" VARCHAR(1000),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EditorialCandidate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DiscoveryCampaign_agencyId_clientId_name_key" ON "DiscoveryCampaign"("agencyId", "clientId", "name");
CREATE INDEX "DiscoveryCampaign_agencyId_clientId_status_createdAt_idx" ON "DiscoveryCampaign"("agencyId", "clientId", "status", "createdAt");
CREATE UNIQUE INDEX "DiscoveryCampaignItem_campaignId_contentId_key" ON "DiscoveryCampaignItem"("campaignId", "contentId");
CREATE INDEX "DiscoveryCampaignItem_agencyId_clientId_workflowStatus_idx" ON "DiscoveryCampaignItem"("agencyId", "clientId", "workflowStatus");
CREATE INDEX "DiscoveryCampaignItem_contentId_createdAt_idx" ON "DiscoveryCampaignItem"("contentId", "createdAt");
CREATE UNIQUE INDEX "EditorialCandidate_campaignItemId_key" ON "EditorialCandidate"("campaignItemId");
CREATE UNIQUE INDEX "EditorialCandidate_referenceKey_key" ON "EditorialCandidate"("referenceKey");
CREATE INDEX "EditorialCandidate_preparedAt_idx" ON "EditorialCandidate"("preparedAt");

ALTER TABLE "DiscoveryCampaign" ADD CONSTRAINT "DiscoveryCampaign_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DiscoveryCampaign" ADD CONSTRAINT "DiscoveryCampaign_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DiscoveryCampaignItem" ADD CONSTRAINT "DiscoveryCampaignItem_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DiscoveryCampaignItem" ADD CONSTRAINT "DiscoveryCampaignItem_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DiscoveryCampaignItem" ADD CONSTRAINT "DiscoveryCampaignItem_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "DiscoveryCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DiscoveryCampaignItem" ADD CONSTRAINT "DiscoveryCampaignItem_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "Content"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EditorialCandidate" ADD CONSTRAINT "EditorialCandidate_campaignItemId_fkey" FOREIGN KEY ("campaignItemId") REFERENCES "DiscoveryCampaignItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
