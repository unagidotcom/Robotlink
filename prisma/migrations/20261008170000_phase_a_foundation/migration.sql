-- CreateEnum
CREATE TYPE "AgencyRole" AS ENUM ('OWNER', 'ADMINISTRATOR', 'STRATEGIST', 'ANALYST', 'VIEWER');

-- CreateEnum
CREATE TYPE "PlatformCode" AS ENUM ('MEDIUM', 'INSTAGRAM', 'WORDPRESS_COM', 'BLOGGER', 'SUBSTACK', 'LINKEDIN', 'PUBLIC_PDF', 'GENERIC');

-- CreateEnum
CREATE TYPE "ContentType" AS ENUM ('ARTICLE', 'POST', 'REEL', 'PDF', 'OTHER');

-- CreateEnum
CREATE TYPE "PublicationStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'UNPUBLISHED', 'REMOVED', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "EvidenceStatus" AS ENUM ('CONFIRMED', 'INDICATION_ONLY', 'NOT_OBSERVED', 'UNAVAILABLE', 'ERROR', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "TechnicalStatus" AS ENUM ('PENDING', 'ACCESSIBLE', 'REDIRECTED', 'BLOCKED', 'NOINDEX_SIGNAL', 'CANONICALIZED_ELSEWHERE', 'UNREACHABLE', 'ERROR', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "VisibilityStatus" AS ENUM ('RANKED', 'PARTIALLY_RANKED', 'NOT_OBSERVED_WITHIN_DEPTH', 'CHECK_PENDING', 'STALE', 'ERROR', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "PromotionStatus" AS ENUM ('NONE', 'SUGGESTED', 'APPROVED', 'SCHEDULED', 'PLACED', 'VERIFIED', 'REMOVED', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "RevenueAvailability" AS ENUM ('CURRENT', 'PARTIAL', 'STALE', 'IMPORT_REQUIRED', 'UNAUTHORIZED', 'UNSUPPORTED', 'ERROR', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "PermissionStatus" AS ENUM ('ALLOWED', 'DENIED', 'UNKNOWN', 'EXPIRED');

-- CreateEnum
CREATE TYPE "CapabilitySupport" AS ENUM ('SUPPORTED', 'PARTIAL', 'UNSUPPORTED', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "DeviceType" AS ENUM ('DESKTOP', 'MOBILE');

-- CreateEnum
CREATE TYPE "SessionEndReason" AS ENUM ('LOGOUT', 'EXPIRED', 'REVOKED', 'PASSWORD_CHANGED', 'USER_DISABLED');

-- CreateEnum
CREATE TYPE "BudgetPeriod" AS ENUM ('DAILY', 'MONTHLY');

-- CreateEnum
CREATE TYPE "BudgetScope" AS ENUM ('AGENCY', 'CLIENT');

-- CreateEnum
CREATE TYPE "AuditActorType" AS ENUM ('USER', 'SYSTEM', 'WORKER', 'INTEGRATION');

-- CreateTable
CREATE TABLE "Agency" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "defaultTimezone" TEXT NOT NULL DEFAULT 'UTC',
    "defaultCurrency" VARCHAR(3) NOT NULL DEFAULT 'USD',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Agency_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "displayName" TEXT,
    "passwordHash" TEXT NOT NULL,
    "disabledAt" TIMESTAMP(3),
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgencyMembership" (
    "agencyId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "role" "AgencyRole" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgencyMembership_pkey" PRIMARY KEY ("agencyId","userId")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "tokenHash" CHAR(64) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "endReason" "SessionEndReason",
    "ipHash" CHAR(64),
    "userAgent" VARCHAR(500),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoginThrottle" (
    "keyHash" CHAR(64) NOT NULL,
    "failureCount" INTEGER NOT NULL DEFAULT 0,
    "windowStarted" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "blockedUntil" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LoginThrottle_pkey" PRIMARY KEY ("keyHash")
);

-- CreateTable
CREATE TABLE "Client" (
    "id" UUID NOT NULL,
    "agencyId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "externalReference" TEXT,
    "defaultCountryCode" VARCHAR(2),
    "defaultLanguageCode" VARCHAR(10),
    "defaultDevice" "DeviceType" NOT NULL DEFAULT 'DESKTOP',
    "defaultCurrency" VARCHAR(3) NOT NULL DEFAULT 'USD',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PublisherAccount" (
    "id" UUID NOT NULL,
    "agencyId" UUID NOT NULL,
    "clientId" UUID NOT NULL,
    "platform" "PlatformCode" NOT NULL,
    "displayName" TEXT NOT NULL,
    "externalAccountId" TEXT,
    "authorizationStatus" "PermissionStatus" NOT NULL DEFAULT 'UNKNOWN',
    "credentialReference" TEXT,
    "grantedScopes" TEXT[],
    "verifiedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PublisherAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformCapability" (
    "id" UUID NOT NULL,
    "platform" "PlatformCode" NOT NULL,
    "capabilityCode" TEXT NOT NULL,
    "supportLevel" "CapabilitySupport" NOT NULL,
    "verificationMethod" TEXT,
    "notes" TEXT,
    "validFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validTo" TIMESTAMP(3),

    CONSTRAINT "PlatformCapability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Content" (
    "id" UUID NOT NULL,
    "agencyId" UUID NOT NULL,
    "clientId" UUID NOT NULL,
    "publisherAccountId" UUID,
    "originalUrl" TEXT NOT NULL,
    "normalizedUrl" TEXT NOT NULL,
    "dedupeHash" CHAR(64) NOT NULL,
    "normalizationVersion" INTEGER NOT NULL DEFAULT 1,
    "platform" "PlatformCode" NOT NULL,
    "contentType" "ContentType" NOT NULL,
    "title" TEXT,
    "publishedAt" TIMESTAMP(3),
    "publicationStatus" "PublicationStatus" NOT NULL DEFAULT 'UNKNOWN',
    "technicalStatus" "TechnicalStatus" NOT NULL DEFAULT 'UNKNOWN',
    "indexingEvidence" "EvidenceStatus" NOT NULL DEFAULT 'UNKNOWN',
    "visibilityStatus" "VisibilityStatus" NOT NULL DEFAULT 'UNKNOWN',
    "promotionStatus" "PromotionStatus" NOT NULL DEFAULT 'UNKNOWN',
    "revenueAvailability" "RevenueAvailability" NOT NULL DEFAULT 'UNKNOWN',
    "recommendedNextAction" TEXT,
    "lastVerifiedAt" TIMESTAMP(3),
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Content_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Keyword" (
    "id" UUID NOT NULL,
    "agencyId" UUID NOT NULL,
    "normalizedPhrase" TEXT NOT NULL,
    "displayPhrase" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Keyword_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentKeyword" (
    "id" UUID NOT NULL,
    "contentId" UUID NOT NULL,
    "keywordId" UUID NOT NULL,
    "countryCode" VARCHAR(2) NOT NULL,
    "languageCode" VARCHAR(10) NOT NULL,
    "device" "DeviceType" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "maxResultDepth" INTEGER NOT NULL DEFAULT 10,
    "lastCheckedAt" TIMESTAMP(3),
    "nextCheckAt" TIMESTAMP(3),

    CONSTRAINT "ContentKeyword_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentPermission" (
    "id" UUID NOT NULL,
    "contentId" UUID NOT NULL,
    "publisherAccountId" UUID,
    "capabilityCode" TEXT NOT NULL,
    "status" "PermissionStatus" NOT NULL DEFAULT 'UNKNOWN',
    "evidenceSource" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "ContentPermission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MonitoringBudget" (
    "id" UUID NOT NULL,
    "agencyId" UUID NOT NULL,
    "clientId" UUID,
    "scope" "BudgetScope" NOT NULL,
    "period" "BudgetPeriod" NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "softLimitMinor" BIGINT NOT NULL,
    "hardLimitMinor" BIGINT NOT NULL,
    "maxOperations" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MonitoringBudget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProviderUsageLedger" (
    "id" UUID NOT NULL,
    "agencyId" UUID NOT NULL,
    "clientId" UUID,
    "providerCode" TEXT NOT NULL,
    "operationType" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "units" INTEGER NOT NULL DEFAULT 1,
    "estimatedMinor" BIGINT NOT NULL,
    "actualMinor" BIGINT,
    "currency" VARCHAR(3) NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProviderUsageLedger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StatusHistory" (
    "id" UUID NOT NULL,
    "agencyId" UUID NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "statusDimension" TEXT NOT NULL,
    "previousValue" TEXT,
    "newValue" TEXT NOT NULL,
    "reason" TEXT,
    "evidenceType" TEXT,
    "evidenceId" TEXT,
    "actorType" "AuditActorType" NOT NULL,
    "actorId" TEXT,
    "correlationId" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" UUID NOT NULL,
    "agencyId" UUID NOT NULL,
    "actorType" "AuditActorType" NOT NULL,
    "actorUserId" UUID,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT,
    "sanitizedData" JSONB,
    "ipHash" CHAR(64),
    "userAgent" VARCHAR(500),
    "correlationId" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Agency_slug_key" ON "Agency"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "AgencyMembership_userId_idx" ON "AgencyMembership"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_userId_expiresAt_idx" ON "Session"("userId", "expiresAt");

-- CreateIndex
CREATE INDEX "LoginThrottle_blockedUntil_idx" ON "LoginThrottle"("blockedUntil");

-- CreateIndex
CREATE INDEX "Client_agencyId_active_idx" ON "Client"("agencyId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "Client_agencyId_name_key" ON "Client"("agencyId", "name");

-- CreateIndex
CREATE INDEX "PublisherAccount_agencyId_clientId_platform_idx" ON "PublisherAccount"("agencyId", "clientId", "platform");

-- CreateIndex
CREATE INDEX "PlatformCapability_platform_capabilityCode_validTo_idx" ON "PlatformCapability"("platform", "capabilityCode", "validTo");

-- CreateIndex
CREATE UNIQUE INDEX "PlatformCapability_platform_capabilityCode_validFrom_key" ON "PlatformCapability"("platform", "capabilityCode", "validFrom");

-- CreateIndex
CREATE INDEX "Content_agencyId_clientId_platform_idx" ON "Content"("agencyId", "clientId", "platform");

-- CreateIndex
CREATE INDEX "Content_agencyId_updatedAt_idx" ON "Content"("agencyId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Content_clientId_dedupeHash_key" ON "Content"("clientId", "dedupeHash");

-- CreateIndex
CREATE INDEX "Keyword_agencyId_idx" ON "Keyword"("agencyId");

-- CreateIndex
CREATE UNIQUE INDEX "Keyword_agencyId_normalizedPhrase_key" ON "Keyword"("agencyId", "normalizedPhrase");

-- CreateIndex
CREATE INDEX "ContentKeyword_active_nextCheckAt_idx" ON "ContentKeyword"("active", "nextCheckAt");

-- CreateIndex
CREATE UNIQUE INDEX "ContentKeyword_contentId_keywordId_countryCode_languageCode_key" ON "ContentKeyword"("contentId", "keywordId", "countryCode", "languageCode", "device");

-- CreateIndex
CREATE UNIQUE INDEX "ContentPermission_contentId_publisherAccountId_capabilityCo_key" ON "ContentPermission"("contentId", "publisherAccountId", "capabilityCode");

-- CreateIndex
CREATE INDEX "MonitoringBudget_agencyId_clientId_active_idx" ON "MonitoringBudget"("agencyId", "clientId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderUsageLedger_idempotencyKey_key" ON "ProviderUsageLedger"("idempotencyKey");

-- CreateIndex
CREATE INDEX "ProviderUsageLedger_agencyId_clientId_occurredAt_idx" ON "ProviderUsageLedger"("agencyId", "clientId", "occurredAt");

-- CreateIndex
CREATE INDEX "StatusHistory_agencyId_entityType_entityId_occurredAt_idx" ON "StatusHistory"("agencyId", "entityType", "entityId", "occurredAt");

-- CreateIndex
CREATE INDEX "AuditEvent_agencyId_occurredAt_idx" ON "AuditEvent"("agencyId", "occurredAt");

-- CreateIndex
CREATE INDEX "AuditEvent_agencyId_targetType_targetId_idx" ON "AuditEvent"("agencyId", "targetType", "targetId");

-- AddForeignKey
ALTER TABLE "AgencyMembership" ADD CONSTRAINT "AgencyMembership_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgencyMembership" ADD CONSTRAINT "AgencyMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Client" ADD CONSTRAINT "Client_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublisherAccount" ADD CONSTRAINT "PublisherAccount_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublisherAccount" ADD CONSTRAINT "PublisherAccount_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Content" ADD CONSTRAINT "Content_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Content" ADD CONSTRAINT "Content_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Content" ADD CONSTRAINT "Content_publisherAccountId_fkey" FOREIGN KEY ("publisherAccountId") REFERENCES "PublisherAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Keyword" ADD CONSTRAINT "Keyword_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentKeyword" ADD CONSTRAINT "ContentKeyword_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "Content"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentKeyword" ADD CONSTRAINT "ContentKeyword_keywordId_fkey" FOREIGN KEY ("keywordId") REFERENCES "Keyword"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentPermission" ADD CONSTRAINT "ContentPermission_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "Content"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentPermission" ADD CONSTRAINT "ContentPermission_publisherAccountId_fkey" FOREIGN KEY ("publisherAccountId") REFERENCES "PublisherAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonitoringBudget" ADD CONSTRAINT "MonitoringBudget_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonitoringBudget" ADD CONSTRAINT "MonitoringBudget_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StatusHistory" ADD CONSTRAINT "StatusHistory_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
