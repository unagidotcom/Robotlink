CREATE TYPE "RankingJobStatus" AS ENUM ('PENDING','RUNNING','COMPLETED','FAILED','CANCELLED','DEAD_LETTER','BUDGET_BLOCKED');
CREATE TYPE "RankingAttemptStatus" AS ENUM ('RUNNING','COMPLETED','FAILED','LEASE_EXPIRED');
CREATE TYPE "RankingObservationStatus" AS ENUM ('RANKED','NOT_FOUND_WITHIN_DEPTH','PROVIDER_ERROR','CHECK_NOT_PERFORMED','INSUFFICIENT_EVIDENCE');
CREATE TYPE "RankingMatchClassification" AS ENUM ('EXACT','VERIFIED_EQUIVALENT','POSSIBLE','NO_MATCH');

DROP INDEX "ContentKeyword_contentId_keywordId_countryCode_languageCode_key";
ALTER TABLE "ContentKeyword" ADD COLUMN "checkFrequencyMinutes" INTEGER NOT NULL DEFAULT 1440,
  ADD COLUMN "priority" INTEGER NOT NULL DEFAULT 0, ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "supersededAt" TIMESTAMP(3);
CREATE UNIQUE INDEX "ContentKeyword_tracking_version_key"
  ON "ContentKeyword"("contentId","keywordId","countryCode","languageCode","device","version");

CREATE TABLE "RankingJob" (
 "id" UUID NOT NULL,"agencyId" UUID NOT NULL,"clientId" UUID NOT NULL,"contentKeywordId" UUID NOT NULL,"requestedById" UUID,
 "providerCode" VARCHAR(50) NOT NULL,"searchEngine" VARCHAR(30) NOT NULL DEFAULT 'google',"keyword" VARCHAR(700) NOT NULL,
 "countryCode" VARCHAR(2) NOT NULL,"languageCode" VARCHAR(10) NOT NULL,"device" "DeviceType" NOT NULL,"depth" INTEGER NOT NULL DEFAULT 10,
 "queryHash" CHAR(64) NOT NULL,"sharedRequestKey" CHAR(64) NOT NULL,"idempotencyKey" CHAR(64) NOT NULL,
 "status" "RankingJobStatus" NOT NULL DEFAULT 'PENDING',"priority" INTEGER NOT NULL DEFAULT 0,"attemptCount" INTEGER NOT NULL DEFAULT 0,
 "maxAttempts" INTEGER NOT NULL DEFAULT 3,"estimatedMinor" BIGINT NOT NULL DEFAULT 0,"currency" VARCHAR(3) NOT NULL DEFAULT 'USD',
 "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"leaseOwner" VARCHAR(200),"leaseExpiresAt" TIMESTAMP(3),
 "startedAt" TIMESTAMP(3),"completedAt" TIMESTAMP(3),"lastErrorCategory" VARCHAR(80),"lastErrorMessage" VARCHAR(500),
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) NOT NULL,CONSTRAINT "RankingJob_pkey" PRIMARY KEY("id")
);
CREATE TABLE "RankingAttempt" (
 "id" UUID NOT NULL,"jobId" UUID NOT NULL,"attemptNumber" INTEGER NOT NULL,"workerId" VARCHAR(200) NOT NULL,
 "status" "RankingAttemptStatus" NOT NULL DEFAULT 'RUNNING',"leaseExpiresAt" TIMESTAMP(3) NOT NULL,"startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "finishedAt" TIMESTAMP(3),"errorCategory" VARCHAR(80),"errorMessage" VARCHAR(500),CONSTRAINT "RankingAttempt_pkey" PRIMARY KEY("id")
);
CREATE TABLE "RankingObservation" (
 "id" UUID NOT NULL,"agencyId" UUID NOT NULL,"clientId" UUID NOT NULL,"contentId" UUID NOT NULL,"contentKeywordId" UUID NOT NULL,"jobId" UUID NOT NULL,
 "providerCode" VARCHAR(50) NOT NULL,"checkedAt" TIMESTAMP(3) NOT NULL,"status" "RankingObservationStatus" NOT NULL,"observedRank" INTEGER,
 "matchedResultUrl" TEXT,"matchClassification" "RankingMatchClassification" NOT NULL,"searchDepth" INTEGER NOT NULL,"providerRequestId" VARCHAR(255),
 "evidenceMetadata" JSONB NOT NULL,"estimatedMinor" BIGINT NOT NULL,"actualMinor" BIGINT,"currency" VARCHAR(3) NOT NULL,
 "errorCategory" VARCHAR(80),"errorMessage" VARCHAR(500),"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "RankingObservation_pkey" PRIMARY KEY("id")
);
CREATE UNIQUE INDEX "RankingJob_idempotencyKey_key" ON "RankingJob"("idempotencyKey");
CREATE INDEX "RankingJob_status_availableAt_priority_idx" ON "RankingJob"("status","availableAt","priority");
CREATE INDEX "RankingJob_agencyId_clientId_status_createdAt_idx" ON "RankingJob"("agencyId","clientId","status","createdAt");
CREATE INDEX "RankingJob_sharedRequestKey_status_idx" ON "RankingJob"("sharedRequestKey","status");
CREATE UNIQUE INDEX "RankingAttempt_jobId_attemptNumber_key" ON "RankingAttempt"("jobId","attemptNumber");
CREATE INDEX "RankingAttempt_status_leaseExpiresAt_idx" ON "RankingAttempt"("status","leaseExpiresAt");
CREATE INDEX "RankingObservation_jobId_contentKeywordId_idx" ON "RankingObservation"("jobId","contentKeywordId");
CREATE INDEX "RankingObservation_agencyId_clientId_checkedAt_idx" ON "RankingObservation"("agencyId","clientId","checkedAt");
CREATE INDEX "RankingObservation_contentKeywordId_checkedAt_idx" ON "RankingObservation"("contentKeywordId","checkedAt");
ALTER TABLE "RankingJob" ADD CONSTRAINT "RankingJob_agencyId_fkey" FOREIGN KEY("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RankingJob" ADD CONSTRAINT "RankingJob_clientId_fkey" FOREIGN KEY("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RankingJob" ADD CONSTRAINT "RankingJob_contentKeywordId_fkey" FOREIGN KEY("contentKeywordId") REFERENCES "ContentKeyword"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RankingJob" ADD CONSTRAINT "RankingJob_requestedById_fkey" FOREIGN KEY("requestedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RankingAttempt" ADD CONSTRAINT "RankingAttempt_jobId_fkey" FOREIGN KEY("jobId") REFERENCES "RankingJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RankingObservation" ADD CONSTRAINT "RankingObservation_agencyId_fkey" FOREIGN KEY("agencyId") REFERENCES "Agency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RankingObservation" ADD CONSTRAINT "RankingObservation_clientId_fkey" FOREIGN KEY("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RankingObservation" ADD CONSTRAINT "RankingObservation_contentId_fkey" FOREIGN KEY("contentId") REFERENCES "Content"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RankingObservation" ADD CONSTRAINT "RankingObservation_contentKeywordId_fkey" FOREIGN KEY("contentKeywordId") REFERENCES "ContentKeyword"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RankingObservation" ADD CONSTRAINT "RankingObservation_jobId_fkey" FOREIGN KEY("jobId") REFERENCES "RankingJob"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
