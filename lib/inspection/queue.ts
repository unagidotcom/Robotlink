import { createHash, randomUUID } from "node:crypto";
import { Prisma, type InspectionJob } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { InspectionConfig } from "./config";
import type { InspectionResult } from "./http-inspector";

export function inspectionKey(contentId: string, normalizedUrl: string, bucket = Math.floor(Date.now() / 900_000)): string {
  return createHash("sha256").update(`${contentId}\0${normalizedUrl}\0${bucket}`).digest("hex");
}

export async function enqueueInspection(input: { agencyId: string; clientId: string; contentId: string; requestedById?: string; force?: boolean }, config: InspectionConfig) {
  const content = await prisma.content.findFirst({ where: { id: input.contentId, agencyId: input.agencyId, clientId: input.clientId, archivedAt: null }, select: { id: true, normalizedUrl: true } });
  if (!content) throw new Error("CONTENT_NOT_FOUND");
  const queued = await prisma.inspectionJob.count({ where: { agencyId: input.agencyId, clientId: input.clientId, status: { in: ["PENDING", "RUNNING"] } } });
  if (queued >= config.INSPECTION_QUEUE_LIMIT_PER_CLIENT) throw new Error("CLIENT_QUEUE_LIMIT");
  const origin = new URL(content.normalizedUrl).origin;
  const idempotencyKey = input.force ? createHash("sha256").update(randomUUID()).digest("hex") : inspectionKey(content.id, content.normalizedUrl);
  return prisma.inspectionJob.upsert({
    where: { idempotencyKey },
    create: { agencyId: input.agencyId, clientId: input.clientId, contentId: content.id, requestedById: input.requestedById,
      idempotencyKey, origin },
    update: {},
  });
}

export async function recoverExpiredLeases(now = new Date()): Promise<number> {
  const expired = await prisma.inspectionJob.findMany({ where: { status: "RUNNING", leaseExpiresAt: { lt: now } }, select: { id: true, attemptCount: true, maxAttempts: true } });
  for (const job of expired) await prisma.$transaction([
    prisma.inspectionAttempt.updateMany({ where: { jobId: job.id, status: "RUNNING" }, data: { status: "LEASE_EXPIRED", finishedAt: now, errorCategory: "LEASE_EXPIRED", errorMessage: "Worker lease expired" } }),
    prisma.inspectionJob.update({ where: { id: job.id }, data: job.attemptCount >= job.maxAttempts
      ? { status: "DEAD_LETTER", leaseOwner: null, leaseExpiresAt: null, completedAt: now, lastErrorCategory: "LEASE_EXPIRED", lastErrorMessage: "Retry limit reached after lease expiry" }
      : { status: "PENDING", leaseOwner: null, leaseExpiresAt: null, availableAt: new Date(now.getTime() + Math.min(300_000, 2 ** job.attemptCount * 5_000)), lastErrorCategory: "LEASE_EXPIRED", lastErrorMessage: "Worker lease expired" } }),
  ]);
  return expired.length;
}

export async function claimInspectionJob(workerId: string, config: InspectionConfig): Promise<InspectionJob | null> {
  const leaseExpiresAt = new Date(Date.now() + config.INSPECTION_LEASE_SECONDS * 1000);
  return prisma.$transaction(async (tx) => {
    // Serialize the short claim decision across worker processes so the configured global cap cannot be oversubscribed.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(76421839)`;
    const running = await tx.inspectionJob.count({ where: { status: "RUNNING" } });
    if (running >= config.INSPECTION_GLOBAL_CONCURRENCY) return null;
    const rows = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT j.id FROM "InspectionJob" j
      LEFT JOIN "InspectionOriginState" o ON o.origin = j.origin
      WHERE j.status = 'PENDING'::"InspectionJobStatus" AND j."availableAt" <= NOW()
        AND COALESCE(o."nextAllowedAt", NOW()) <= NOW()
        AND (SELECT COUNT(*) FROM "InspectionJob" c WHERE c."clientId" = j."clientId" AND c.status = 'RUNNING'::"InspectionJobStatus") < ${config.INSPECTION_PER_CLIENT_CONCURRENCY}
      ORDER BY j.priority DESC, j."availableAt" ASC, j."createdAt" ASC
      FOR UPDATE OF j SKIP LOCKED LIMIT 1`);
    const id = rows[0]?.id; if (!id) return null;
    const job = await tx.inspectionJob.update({ where: { id }, data: { status: "RUNNING", leaseOwner: workerId, leaseExpiresAt,
      startedAt: new Date(), attemptCount: { increment: 1 } } });
    await tx.inspectionAttempt.create({ data: { jobId: id, attemptNumber: job.attemptCount, workerId, leaseExpiresAt } });
    await tx.inspectionOriginState.upsert({ where: { origin: job.origin }, create: { origin: job.origin, lastRequestedAt: new Date(), nextAllowedAt: new Date(Date.now() + config.INSPECTION_ORIGIN_DELAY_MS) },
      update: { lastRequestedAt: new Date(), nextAllowedAt: new Date(Date.now() + config.INSPECTION_ORIGIN_DELAY_MS) } });
    return job;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });
}

export function retryDelay(attempt: number): number { return Math.min(300_000, 2 ** Math.max(0, attempt - 1) * 5_000); }

export async function finishInspection(job: InspectionJob, result: InspectionResult, config: InspectionConfig): Promise<void> {
  const now = new Date();
  await prisma.$transaction(async (tx) => {
    const live = await tx.inspectionJob.findFirst({ where: { id: job.id, status: "RUNNING", leaseOwner: job.leaseOwner }, include: { attempts: { where: { status: "RUNNING" }, orderBy: { attemptNumber: "desc" }, take: 1 } } });
    const attempt = live?.attempts[0]; if (!live || !attempt) throw new Error("LEASE_LOST");
    const retryable = result.outcome === "ERROR" || result.outcome === "TEMPORARILY_UNAVAILABLE";
    if (retryable) {
      const exhausted = live.attemptCount >= live.maxAttempts;
      const evidence = await tx.technicalInspection.create({ data: { agencyId: live.agencyId, clientId: live.clientId, contentId: live.contentId, jobId: live.id, attemptId: attempt.id,
        requestedUrl: result.requestedUrl, finalUrl: result.finalUrl, outcome: result.outcome, derivedTechnicalStatus: result.derivedTechnicalStatus,
        httpStatus: result.httpStatus, contentType: result.contentType, contentLength: result.contentLength, title: result.title, metaDescription: result.metaDescription,
        canonicalUrl: result.canonicalUrl, metaRobots: result.metaRobots, xRobotsTag: result.xRobotsTag, robotsAllowed: result.robotsAllowed,
        robotsRule: result.robotsRule, rawObservations: result.rawObservations as Prisma.InputJsonValue, errorCategory: result.errorCategory, errorMessage: result.errorMessage,
        inspectedAt: now, expiresAt: new Date(now.getTime() + config.INSPECTION_EVIDENCE_TTL_HOURS * 3_600_000),
        redirects: { createMany: { data: result.redirects.map(({ sequence, fromUrl, toUrl, httpStatus }) => ({ sequence, fromUrl, toUrl, httpStatus })) } } } });
      const current = await tx.content.findUniqueOrThrow({ where: { id: live.contentId }, select: { technicalStatus: true } });
      await tx.content.update({ where: { id: live.contentId }, data: { technicalStatus: result.derivedTechnicalStatus, lastVerifiedAt: now } });
      if (current.technicalStatus !== result.derivedTechnicalStatus) await tx.statusHistory.create({ data: { agencyId: live.agencyId, entityType: "content", entityId: live.contentId,
        statusDimension: "technical", previousValue: current.technicalStatus, newValue: result.derivedTechnicalStatus, reason: "Automated technical inspection failed",
        evidenceType: "technical_inspection", evidenceId: evidence.id, actorType: "WORKER", actorId: live.leaseOwner } });
      await tx.inspectionAttempt.update({ where: { id: attempt.id }, data: { status: "FAILED", finishedAt: now, errorCategory: result.errorCategory ?? result.outcome, errorMessage: result.errorMessage } });
      await tx.inspectionJob.update({ where: { id: live.id }, data: exhausted
        ? { status: "DEAD_LETTER", completedAt: now, leaseOwner: null, leaseExpiresAt: null, lastErrorCategory: result.errorCategory ?? result.outcome, lastErrorMessage: result.errorMessage }
        : { status: "PENDING", availableAt: new Date(now.getTime() + retryDelay(live.attemptCount)), leaseOwner: null, leaseExpiresAt: null, lastErrorCategory: result.errorCategory ?? result.outcome, lastErrorMessage: result.errorMessage } });
      return;
    }
    const evidence = await tx.technicalInspection.create({ data: { agencyId: live.agencyId, clientId: live.clientId, contentId: live.contentId, jobId: live.id, attemptId: attempt.id,
      requestedUrl: result.requestedUrl, finalUrl: result.finalUrl, outcome: result.outcome, derivedTechnicalStatus: result.derivedTechnicalStatus,
      httpStatus: result.httpStatus, contentType: result.contentType, contentLength: result.contentLength, title: result.title, metaDescription: result.metaDescription,
      canonicalUrl: result.canonicalUrl, metaRobots: result.metaRobots, xRobotsTag: result.xRobotsTag, robotsAllowed: result.robotsAllowed,
      robotsRule: result.robotsRule, rawObservations: result.rawObservations as Prisma.InputJsonValue, errorCategory: result.errorCategory, errorMessage: result.errorMessage,
      inspectedAt: now, expiresAt: new Date(now.getTime() + config.INSPECTION_EVIDENCE_TTL_HOURS * 3_600_000),
      redirects: { createMany: { data: result.redirects.map(({ sequence, fromUrl, toUrl, httpStatus }) => ({ sequence, fromUrl, toUrl, httpStatus })) } } } });
    const content = await tx.content.findUniqueOrThrow({ where: { id: live.contentId }, select: { technicalStatus: true, lastVerifiedAt: true } });
    if (!content.lastVerifiedAt || content.lastVerifiedAt <= now) {
      await tx.content.update({ where: { id: live.contentId }, data: { technicalStatus: result.derivedTechnicalStatus, lastVerifiedAt: now } });
      if (content.technicalStatus !== result.derivedTechnicalStatus) await tx.statusHistory.create({ data: { agencyId: live.agencyId, entityType: "content", entityId: live.contentId,
        statusDimension: "technical", previousValue: content.technicalStatus, newValue: result.derivedTechnicalStatus, reason: "Automated technical inspection",
        evidenceType: "technical_inspection", evidenceId: evidence.id, actorType: "WORKER", actorId: live.leaseOwner } });
    }
    await tx.inspectionAttempt.update({ where: { id: attempt.id }, data: { status: "COMPLETED", finishedAt: now } });
    await tx.inspectionJob.update({ where: { id: live.id }, data: { status: "COMPLETED", completedAt: now, leaseOwner: null, leaseExpiresAt: null } });
    await tx.auditEvent.create({ data: { agencyId: live.agencyId, actorType: "WORKER", action: "inspection.completed", targetType: "content", targetId: live.contentId,
      sanitizedData: { outcome: result.outcome, technicalStatus: result.derivedTechnicalStatus, httpStatus: result.httpStatus }, correlationId: live.id } });
  }, { timeout: 30_000 });
}
