-- Phase B2: durable, tenant-scoped technical inspection queue and immutable evidence.
CREATE TYPE "InspectionJobStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED', 'DEAD_LETTER');
CREATE TYPE "InspectionAttemptStatus" AS ENUM ('RUNNING', 'COMPLETED', 'FAILED', 'LEASE_EXPIRED');
CREATE TYPE "InspectionOutcome" AS ENUM ('ACCESSIBLE', 'RESTRICTED', 'AUTH_REQUIRED', 'TEMPORARILY_UNAVAILABLE', 'PERMANENTLY_UNAVAILABLE', 'ERROR', 'UNKNOWN');

CREATE TABLE "InspectionJob" (
  "id" UUID NOT NULL, "agencyId" UUID NOT NULL, "clientId" UUID NOT NULL, "contentId" UUID NOT NULL,
  "requestedById" UUID, "idempotencyKey" CHAR(64) NOT NULL, "origin" VARCHAR(500) NOT NULL,
  "status" "InspectionJobStatus" NOT NULL DEFAULT 'PENDING', "priority" INTEGER NOT NULL DEFAULT 0,
  "attemptCount" INTEGER NOT NULL DEFAULT 0, "maxAttempts" INTEGER NOT NULL DEFAULT 3,
  "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "leaseOwner" VARCHAR(200), "leaseExpiresAt" TIMESTAMP(3),
  "startedAt" TIMESTAMP(3), "completedAt" TIMESTAMP(3), "cancelledAt" TIMESTAMP(3),
  "lastErrorCategory" VARCHAR(80), "lastErrorMessage" VARCHAR(500),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InspectionJob_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "InspectionAttempt" (
  "id" UUID NOT NULL, "jobId" UUID NOT NULL, "attemptNumber" INTEGER NOT NULL, "workerId" VARCHAR(200) NOT NULL,
  "status" "InspectionAttemptStatus" NOT NULL DEFAULT 'RUNNING', "leaseExpiresAt" TIMESTAMP(3) NOT NULL,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "finishedAt" TIMESTAMP(3),
  "errorCategory" VARCHAR(80), "errorMessage" VARCHAR(500), CONSTRAINT "InspectionAttempt_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "TechnicalInspection" (
  "id" UUID NOT NULL, "agencyId" UUID NOT NULL, "clientId" UUID NOT NULL, "contentId" UUID NOT NULL,
  "jobId" UUID NOT NULL, "attemptId" UUID NOT NULL, "source" VARCHAR(100) NOT NULL DEFAULT 'internal-http-inspector',
  "requestedUrl" TEXT NOT NULL, "finalUrl" TEXT, "outcome" "InspectionOutcome" NOT NULL,
  "derivedTechnicalStatus" "TechnicalStatus" NOT NULL, "httpStatus" INTEGER, "contentType" VARCHAR(255),
  "contentLength" INTEGER, "title" TEXT, "metaDescription" TEXT, "canonicalUrl" TEXT,
  "metaRobots" TEXT[] NOT NULL, "xRobotsTag" TEXT[] NOT NULL, "robotsAllowed" BOOLEAN, "robotsRule" TEXT,
  "rawObservations" JSONB NOT NULL, "errorCategory" VARCHAR(80), "errorMessage" VARCHAR(500),
  "inspectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "TechnicalInspection_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "InspectionRedirect" (
  "id" UUID NOT NULL, "inspectionId" UUID NOT NULL, "sequence" INTEGER NOT NULL, "fromUrl" TEXT NOT NULL,
  "toUrl" TEXT NOT NULL, "httpStatus" INTEGER NOT NULL, CONSTRAINT "InspectionRedirect_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "InspectionOriginState" (
  "origin" VARCHAR(500) NOT NULL, "nextAllowedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastRequestedAt" TIMESTAMP(3), "consecutiveErrors" INTEGER NOT NULL DEFAULT 0, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InspectionOriginState_pkey" PRIMARY KEY ("origin")
);

CREATE UNIQUE INDEX "InspectionJob_idempotencyKey_key" ON "InspectionJob"("idempotencyKey");
CREATE INDEX "InspectionJob_status_availableAt_priority_idx" ON "InspectionJob"("status", "availableAt", "priority");
CREATE INDEX "InspectionJob_agencyId_clientId_status_createdAt_idx" ON "InspectionJob"("agencyId", "clientId", "status", "createdAt");
CREATE INDEX "InspectionJob_contentId_createdAt_idx" ON "InspectionJob"("contentId", "createdAt");
CREATE INDEX "InspectionJob_origin_status_availableAt_idx" ON "InspectionJob"("origin", "status", "availableAt");
CREATE UNIQUE INDEX "InspectionAttempt_jobId_attemptNumber_key" ON "InspectionAttempt"("jobId", "attemptNumber");
CREATE INDEX "InspectionAttempt_status_leaseExpiresAt_idx" ON "InspectionAttempt"("status", "leaseExpiresAt");
CREATE UNIQUE INDEX "TechnicalInspection_attemptId_key" ON "TechnicalInspection"("attemptId");
CREATE INDEX "TechnicalInspection_agencyId_clientId_inspectedAt_idx" ON "TechnicalInspection"("agencyId", "clientId", "inspectedAt");
CREATE INDEX "TechnicalInspection_contentId_inspectedAt_idx" ON "TechnicalInspection"("contentId", "inspectedAt");
CREATE UNIQUE INDEX "InspectionRedirect_inspectionId_sequence_key" ON "InspectionRedirect"("inspectionId", "sequence");
CREATE INDEX "InspectionOriginState_nextAllowedAt_idx" ON "InspectionOriginState"("nextAllowedAt");

ALTER TABLE "InspectionJob" ADD CONSTRAINT "InspectionJob_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InspectionJob" ADD CONSTRAINT "InspectionJob_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InspectionJob" ADD CONSTRAINT "InspectionJob_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "Content"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InspectionJob" ADD CONSTRAINT "InspectionJob_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InspectionAttempt" ADD CONSTRAINT "InspectionAttempt_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "InspectionJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TechnicalInspection" ADD CONSTRAINT "TechnicalInspection_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TechnicalInspection" ADD CONSTRAINT "TechnicalInspection_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TechnicalInspection" ADD CONSTRAINT "TechnicalInspection_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "Content"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TechnicalInspection" ADD CONSTRAINT "TechnicalInspection_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "InspectionJob"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TechnicalInspection" ADD CONSTRAINT "TechnicalInspection_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "InspectionAttempt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InspectionRedirect" ADD CONSTRAINT "InspectionRedirect_inspectionId_fkey" FOREIGN KEY ("inspectionId") REFERENCES "TechnicalInspection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
