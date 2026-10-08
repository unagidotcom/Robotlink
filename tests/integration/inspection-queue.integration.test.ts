import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getInspectionConfig } from "@/lib/inspection/config";

const enabled = process.env.RUN_DATABASE_INTEGRATION === "true" && Boolean(process.env.TEST_DATABASE_URL);
const config = getInspectionConfig({ INSPECTION_GLOBAL_CONCURRENCY: "8", INSPECTION_PER_CLIENT_CONCURRENCY: "8", INSPECTION_ORIGIN_DELAY_MS: "250" });

describe.skipIf(!enabled)("PostgreSQL inspection queue", () => {
  let prisma: import("@prisma/client").PrismaClient; let agencyId: string; let clientId: string; let contentId: string;
  const suffix = crypto.randomUUID();
  beforeAll(async () => {
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
    const { PrismaClient } = await import("@prisma/client"); prisma = new PrismaClient();
    const agency = await prisma.agency.create({ data: { name: "Inspection Integration", slug: `inspection-${suffix}` } }); agencyId = agency.id;
    const client = await prisma.client.create({ data: { agencyId, name: "Inspection Client" } }); clientId = client.id;
    const content = await prisma.content.create({ data: { agencyId, clientId, originalUrl: "https://example.com/article", normalizedUrl: "https://example.com/article", dedupeHash: "d".repeat(64), platform: "GENERIC", contentType: "ARTICLE" } }); contentId = content.id;
  });
  afterAll(async () => { if (!prisma) return; await prisma.statusHistory.deleteMany({ where: { agencyId } }); await prisma.auditEvent.deleteMany({ where: { agencyId } }); await prisma.technicalInspection.deleteMany({ where: { agencyId } }); await prisma.agency.delete({ where: { id: agencyId } }); await prisma.$disconnect(); });

  it("enqueues idempotently and denies cross-tenant content", async () => {
    const { enqueueInspection } = await import("@/lib/inspection/queue");
    const first = await enqueueInspection({ agencyId, clientId, contentId }, config); const second = await enqueueInspection({ agencyId, clientId, contentId }, config);
    expect(second.id).toBe(first.id);
    await expect(enqueueInspection({ agencyId: crypto.randomUUID(), clientId, contentId }, config)).rejects.toThrow("CONTENT_NOT_FOUND");
  });

  it("claims a job only once under concurrency", async () => {
    const { claimInspectionJob } = await import("@/lib/inspection/queue");
    const claims = await Promise.all([claimInspectionJob("worker-a", config), claimInspectionJob("worker-b", config)]);
    expect(claims.filter(Boolean)).toHaveLength(1);
  });

  it("recovers an expired lease with retry backoff", async () => {
    const running = await prisma.inspectionJob.findFirstOrThrow({ where: { contentId, status: "RUNNING" } });
    await prisma.inspectionJob.update({ where: { id: running.id }, data: { leaseExpiresAt: new Date(Date.now() - 1000) } });
    const { recoverExpiredLeases } = await import("@/lib/inspection/queue"); expect(await recoverExpiredLeases()).toBeGreaterThanOrEqual(1);
    await expect(prisma.inspectionJob.findUnique({ where: { id: running.id } })).resolves.toMatchObject({ status: "PENDING", leaseOwner: null });
  });

  it("moves an exhausted retryable failure to dead letter", async () => {
    const { enqueueInspection, claimInspectionJob, finishInspection } = await import("@/lib/inspection/queue");
    const queued = await enqueueInspection({ agencyId, clientId, contentId, force: true }, config); await prisma.inspectionJob.update({ where: { id: queued.id }, data: { maxAttempts: 1, priority: 10 } });
    const claimed = await claimInspectionJob("worker-dead", config); expect(claimed?.id).toBe(queued.id);
    await finishInspection(claimed!, { requestedUrl: "https://example.com/article", outcome: "ERROR", derivedTechnicalStatus: "ERROR", metaRobots: [], xRobotsTag: [], redirects: [], errorCategory: "TOTAL_TIMEOUT", errorMessage: "Inspection timed out", rawObservations: {} }, config);
    await expect(prisma.inspectionJob.findUnique({ where: { id: queued.id } })).resolves.toMatchObject({ status: "DEAD_LETTER" });
    expect(await prisma.technicalInspection.count({ where: { jobId: queued.id, errorCategory: "TOTAL_TIMEOUT" } })).toBe(1);
  });

  it("atomically appends evidence and status history without changing indexing evidence", async () => {
    await prisma.inspectionOriginState.updateMany({ data: { nextAllowedAt: new Date(0) } });
    const { enqueueInspection, claimInspectionJob, finishInspection } = await import("@/lib/inspection/queue");
    const queued = await enqueueInspection({ agencyId, clientId, contentId, force: true }, config); await prisma.inspectionJob.update({ where: { id: queued.id }, data: { priority: 20 } });
    const claimed = await claimInspectionJob("worker-success", config); expect(claimed?.id).toBe(queued.id);
    await finishInspection(claimed!, { requestedUrl: "https://example.com/article", finalUrl: "https://example.com/article", outcome: "ACCESSIBLE", derivedTechnicalStatus: "ACCESSIBLE", httpStatus: 200, contentType: "text/html", contentLength: 20, title: "Article", metaRobots: [], xRobotsTag: [], robotsAllowed: true, redirects: [], rawObservations: { robotsChecked: true } }, config);
    const content = await prisma.content.findUniqueOrThrow({ where: { id: contentId } }); expect(content.technicalStatus).toBe("ACCESSIBLE"); expect(content.indexingEvidence).toBe("UNKNOWN");
    expect(await prisma.technicalInspection.count({ where: { jobId: queued.id } })).toBe(1);
    expect(await prisma.statusHistory.count({ where: { entityId: contentId, evidenceType: "technical_inspection" } })).toBeGreaterThanOrEqual(1);
  });
});
