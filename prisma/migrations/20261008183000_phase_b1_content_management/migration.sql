-- Phase B1: content metadata and idempotent CSV import infrastructure.

ALTER TABLE "Content" ADD COLUMN "description" TEXT;

CREATE TYPE "ImportStatus" AS ENUM ('PREVIEWED', 'IMPORTING', 'COMPLETED', 'FAILED');
CREATE TYPE "ImportRowStatus" AS ENUM ('VALID', 'DUPLICATE', 'REJECTED', 'IMPORTED');

CREATE TABLE "ImportBatch" (
    "id" UUID NOT NULL,
    "agencyId" UUID NOT NULL,
    "clientId" UUID NOT NULL,
    "idempotencyKey" CHAR(64) NOT NULL,
    "originalFilename" TEXT NOT NULL,
    "status" "ImportStatus" NOT NULL DEFAULT 'PREVIEWED',
    "totalRows" INTEGER NOT NULL DEFAULT 0,
    "validRows" INTEGER NOT NULL DEFAULT 0,
    "duplicateRows" INTEGER NOT NULL DEFAULT 0,
    "rejectedRows" INTEGER NOT NULL DEFAULT 0,
    "importedRows" INTEGER NOT NULL DEFAULT 0,
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    CONSTRAINT "ImportBatch_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ImportRow" (
    "id" UUID NOT NULL,
    "importBatchId" UUID NOT NULL,
    "rowNumber" INTEGER NOT NULL,
    "status" "ImportRowStatus" NOT NULL,
    "rawData" JSONB NOT NULL,
    "normalizedData" JSONB,
    "rejectionReason" TEXT,
    "dedupeHash" CHAR(64),
    "contentId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ImportRow_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ImportBatch_agencyId_clientId_idempotencyKey_key" ON "ImportBatch"("agencyId", "clientId", "idempotencyKey");
CREATE INDEX "ImportBatch_agencyId_clientId_createdAt_idx" ON "ImportBatch"("agencyId", "clientId", "createdAt");
CREATE UNIQUE INDEX "ImportRow_importBatchId_rowNumber_key" ON "ImportRow"("importBatchId", "rowNumber");
CREATE INDEX "ImportRow_importBatchId_status_idx" ON "ImportRow"("importBatchId", "status");
CREATE INDEX "ImportRow_contentId_idx" ON "ImportRow"("contentId");

ALTER TABLE "ImportBatch" ADD CONSTRAINT "ImportBatch_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ImportBatch" ADD CONSTRAINT "ImportBatch_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ImportRow" ADD CONSTRAINT "ImportRow_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "ImportBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ImportRow" ADD CONSTRAINT "ImportRow_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "Content"("id") ON DELETE SET NULL ON UPDATE CASCADE;
