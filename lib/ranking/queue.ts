import { createHash, randomUUID } from "node:crypto";
import { Prisma, type RankingJob } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { evaluateBudget } from "@/providers/budget";
import type { RankingResult } from "@/providers/types";
import type { RankingConfig } from "./config";
import { matchRankingUrl } from "./url-match";

const hash = (value: string) => createHash("sha256").update(value).digest("hex");
export function rankingQueryHash(input: { keyword: string; countryCode: string; languageCode: string; device: string; depth: number; providerCode: string }) { return hash(JSON.stringify(input)); }
export async function enqueueRanking(input: { agencyId: string; clientId: string; contentKeywordId: string; requestedById?: string; force?: boolean }, config: RankingConfig) {
  const target = await prisma.contentKeyword.findFirst({ where: { id: input.contentKeywordId, active: true, content: { agencyId: input.agencyId, clientId: input.clientId, archivedAt: null } }, include: { keyword: true, content: true } });
  if (!target) throw new Error("TRACKING_NOT_FOUND");
  if (await prisma.rankingJob.count({ where: { clientId: input.clientId, status: { in: ["PENDING", "RUNNING"] } } }) >= config.RANKING_QUEUE_LIMIT_PER_CLIENT) throw new Error("CLIENT_QUEUE_LIMIT");
  const query = { keyword: target.keyword.normalizedPhrase, countryCode: target.countryCode, languageCode: target.languageCode, device: target.device, depth: Math.max(10, Math.min(100, target.maxResultDepth)), providerCode: "dataforseo" };
  const queryHash = rankingQueryHash(query); const bucket = Math.floor(Date.now() / 900_000); const sharedRequestKey = hash(`${queryHash}:${bucket}`);
  const idempotencyKey = hash(`${target.id}:${sharedRequestKey}:${input.force ? randomUUID() : "scheduled"}`);
  return prisma.rankingJob.upsert({ where: { idempotencyKey }, update: {}, create: { agencyId: input.agencyId, clientId: input.clientId, contentKeywordId: target.id,
    requestedById: input.requestedById, providerCode: "dataforseo", keyword: query.keyword, countryCode: query.countryCode, languageCode: query.languageCode,
    device: query.device, depth: query.depth, queryHash, sharedRequestKey, idempotencyKey, priority: target.priority, estimatedMinor: config.DATAFORSEO_TOP10_ESTIMATED_MINOR * BigInt(Math.ceil(query.depth / 10)) } });
}

export async function scheduleDueRankings(config: RankingConfig, now = new Date()): Promise<number> {
  const due = await prisma.contentKeyword.findMany({ where: { active: true, OR: [{ nextCheckAt: null }, { nextCheckAt: { lte: now } }], content: { archivedAt: null, client: { active: true } } }, select: { id: true, content: { select: { agencyId: true, clientId: true } } }, take: 100 });
  let scheduled = 0;
  for (const target of due) { try { await enqueueRanking({ agencyId: target.content.agencyId, clientId: target.content.clientId, contentKeywordId: target.id }, config); scheduled += 1; } catch (error) { if (!(error instanceof Error && error.message === "CLIENT_QUEUE_LIMIT")) throw error; } }
  return scheduled;
}

async function budgetAllowed(tx: Prisma.TransactionClient, job: RankingJob, config: RankingConfig) {
  const start = new Date(); start.setUTCHours(0, 0, 0, 0);
  const global = await tx.providerUsageLedger.aggregate({ where: { occurredAt: { gte: start }, currency: job.currency }, _sum: { estimatedMinor: true }, _count: true });
  if ((global._sum.estimatedMinor ?? 0n) + job.estimatedMinor > config.RANKING_GLOBAL_DAILY_LIMIT_MINOR) return false;
  const budget = await tx.monitoringBudget.findFirst({ where: { agencyId: job.agencyId, active: true, OR: [{ clientId: job.clientId }, { clientId: null }] }, orderBy: { clientId: "desc" } });
  if (!budget) return false;
  const periodStart = new Date(start); if (budget.period === "MONTHLY") periodStart.setUTCDate(1);
  const spent = await tx.providerUsageLedger.aggregate({ where: { agencyId: job.agencyId, ...(budget.clientId ? { clientId: budget.clientId } : {}), occurredAt: { gte: periodStart }, currency: budget.currency }, _sum: { estimatedMinor: true }, _count: true });
  return evaluateBudget({ hardLimitMinor: budget.hardLimitMinor, spentMinor: spent._sum.estimatedMinor ?? 0n, reservedMinor: 0n, currency: budget.currency, operationsUsed: spent._count, maxOperations: budget.maxOperations ?? undefined }, { amountMinor: job.estimatedMinor, currency: job.currency, units: 1 }).allowed;
}

export async function claimRankingGroup(workerId: string, config: RankingConfig): Promise<RankingJob[]> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(76421840)`;
    if (await tx.rankingJob.count({ where: { status: "RUNNING" } }) >= config.RANKING_GLOBAL_CONCURRENCY) return [];
    const ids = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`SELECT id FROM "RankingJob" WHERE status='PENDING'::"RankingJobStatus" AND "availableAt"<=NOW() ORDER BY priority DESC,"createdAt" ASC FOR UPDATE SKIP LOCKED LIMIT 1`);
    const seed = ids[0] ? await tx.rankingJob.findUnique({ where: { id: ids[0].id } }) : null; if (!seed) return [];
    if (!(await budgetAllowed(tx, seed, config))) { await tx.rankingJob.update({ where: { id: seed.id }, data: { status: "BUDGET_BLOCKED", completedAt: new Date(), lastErrorCategory: "BUDGET_BLOCKED" } }); return []; }
    const candidates = await tx.rankingJob.findMany({ where: { sharedRequestKey: seed.sharedRequestKey, status: "PENDING" }, take: 100 }); const group: RankingJob[] = []; const lease = new Date(Date.now() + config.RANKING_LEASE_SECONDS * 1000);
    for (const job of candidates) { if (!(await budgetAllowed(tx, job, config))) { await tx.rankingJob.update({ where: { id: job.id }, data: { status: "BUDGET_BLOCKED", completedAt: new Date(), lastErrorCategory: "BUDGET_BLOCKED" } }); continue; } group.push(job); await tx.rankingJob.update({ where: { id: job.id }, data: { status: "RUNNING", leaseOwner: workerId, leaseExpiresAt: lease, startedAt: new Date(), attemptCount: { increment: 1 } } });
      await tx.rankingAttempt.create({ data: { jobId: job.id, attemptNumber: job.attemptCount + 1, workerId, leaseExpiresAt: lease } }); }
    return tx.rankingJob.findMany({ where: { id: { in: group.map((j) => j.id) } } });
  }, { maxWait: 15_000, timeout: 30_000 });
}

export async function recoverRankingLeases(now = new Date()) { const jobs = await prisma.rankingJob.findMany({ where: { status: "RUNNING", leaseExpiresAt: { lt: now } } }); for (const job of jobs) await prisma.$transaction([
  prisma.rankingAttempt.updateMany({ where: { jobId: job.id, status: "RUNNING" }, data: { status: "LEASE_EXPIRED", finishedAt: now, errorCategory: "LEASE_EXPIRED" } }),
  prisma.rankingJob.update({ where: { id: job.id }, data: job.attemptCount >= job.maxAttempts ? { status: "DEAD_LETTER", completedAt: now, leaseOwner: null, leaseExpiresAt: null } : { status: "PENDING", availableAt: new Date(now.getTime() + Math.min(300000, 5000 * 2 ** job.attemptCount)), leaseOwner: null, leaseExpiresAt: null } }) ]); return jobs.length; }

export async function finishRankingGroup(jobs: RankingJob[], result: RankingResult | Error) {
  const now = result instanceof Error ? new Date() : result.observedAt; const share = result instanceof Error ? undefined : result.actualCostMinor === undefined ? undefined : result.actualCostMinor / BigInt(Math.max(1, jobs.length));
  await prisma.$transaction(async (tx) => { for (const job of jobs) {
    const attempt = await tx.rankingAttempt.findFirstOrThrow({ where: { jobId: job.id, status: "RUNNING" }, orderBy: { attemptNumber: "desc" } });
    const target = await tx.contentKeyword.findUniqueOrThrow({ where: { id: job.contentKeywordId }, include: { content: { include: { inspections: { orderBy: { inspectedAt: "desc" }, take: 1 } } } } });
    if (result instanceof Error) { const exhausted = job.attemptCount >= job.maxAttempts; await tx.rankingObservation.create({ data: { agencyId: job.agencyId, clientId: job.clientId, contentId: target.contentId, contentKeywordId: target.id, jobId: job.id, providerCode: job.providerCode, checkedAt: now, status: "PROVIDER_ERROR", matchClassification: "NO_MATCH", searchDepth: job.depth, evidenceMetadata: {}, estimatedMinor: job.estimatedMinor, currency: job.currency, errorCategory: "PROVIDER_ERROR", errorMessage: result.message.slice(0, 500) } }); await tx.rankingAttempt.update({ where: { id: attempt.id }, data: { status: "FAILED", finishedAt: now, errorCategory: "PROVIDER_ERROR", errorMessage: result.message.slice(0, 500) } }); await tx.rankingJob.update({ where: { id: job.id }, data: exhausted ? { status: "DEAD_LETTER", completedAt: now, leaseOwner: null, leaseExpiresAt: null } : { status: "PENDING", availableAt: new Date(Date.now() + 5000 * 2 ** job.attemptCount), leaseOwner: null, leaseExpiresAt: null } }); continue; }
    const equivalents = target.content.inspections.flatMap((i) => [i.finalUrl, i.canonicalUrl].filter((v): v is string => Boolean(v))); const matches = result.results.map((item) => ({ item, match: matchRankingUrl(target.content.normalizedUrl, item.url, equivalents) })).filter((x) => x.match !== "NO_MATCH").sort((a,b) => a.item.position-b.item.position); const best = matches[0];
    const status = result.incomplete ? "INSUFFICIENT_EVIDENCE" : best ? "RANKED" : "NOT_FOUND_WITHIN_DEPTH";
    await tx.rankingObservation.create({ data: { agencyId: job.agencyId, clientId: job.clientId, contentId: target.contentId, contentKeywordId: target.id, jobId: job.id, providerCode: job.providerCode, checkedAt: now, status, observedRank: best?.item.position, matchedResultUrl: best?.item.url, matchClassification: best?.match ?? "NO_MATCH", searchDepth: job.depth, providerRequestId: result.providerRequestId, evidenceMetadata: { returnedOrganicResults: result.results.length }, estimatedMinor: job.estimatedMinor, actualMinor: share, currency: result.currency ?? job.currency } });
    await tx.providerUsageLedger.create({ data: { agencyId: job.agencyId, clientId: job.clientId, providerCode: job.providerCode, operationType: "keyword_rank", idempotencyKey: job.idempotencyKey, estimatedMinor: job.estimatedMinor, actualMinor: share, currency: job.currency } });
    await tx.rankingAttempt.update({ where: { id: attempt.id }, data: { status: "COMPLETED", finishedAt: now } }); await tx.rankingJob.update({ where: { id: job.id }, data: { status: "COMPLETED", completedAt: now, leaseOwner: null, leaseExpiresAt: null } }); await tx.contentKeyword.update({ where: { id: target.id }, data: { lastCheckedAt: now, nextCheckAt: new Date(now.getTime() + target.checkFrequencyMinutes * 60000) } });
    const visibility = best ? "RANKED" : "NOT_OBSERVED_WITHIN_DEPTH"; await tx.content.update({ where: { id: target.contentId }, data: { visibilityStatus: visibility } });
  } }, { timeout: 60_000 });
}
