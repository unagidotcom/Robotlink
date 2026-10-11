"use server";

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireViewer } from "@/lib/dal/viewer";
import { requirePermission } from "@/lib/auth/authorization";
import { clientInputSchema, contentInputSchema } from "@/lib/content/validation";
import { NORMALIZATION_VERSION, normalizeContentUrl, normalizeKeyword } from "@/lib/content/normalize";
import { csvMappingSchema, type CsvMapping, type ValidatedImportRow } from "@/lib/imports/validation";
import { MAX_CSV_BYTES, parseCsv } from "@/lib/imports/csv";
import { buildPreviewRows, parsePastedUrls, type ImportSourceRow } from "@/lib/imports/preview";
import { getInspectionConfig } from "@/lib/inspection/config";
import { enqueueInspection, scheduleImportedInspections } from "@/lib/inspection/queue";
import { getRankingConfig } from "@/lib/ranking/config";
import { enqueueRanking } from "@/lib/ranking/queue";

export type ActionState = { ok?: boolean; error?: string; batchId?: string };

export async function enqueueRankingAction(contentKeywordId: string, agencyId: string): Promise<void> {
  const viewer = await requireViewer(agencyId); requirePermission(viewer.role, "ranking:write");
  const target = await prisma.contentKeyword.findFirst({ where: { id: contentKeywordId, active: true, content: { agencyId: viewer.agencyId, archivedAt: null } }, include: { content: { select: { id: true, clientId: true } } } });
  if (!target) throw new Error("NOT_FOUND");
  const active = await prisma.rankingJob.findFirst({ where: { contentKeywordId, status: { in: ["PENDING", "RUNNING"] } }, select: { id: true } });
  if (!active) await enqueueRanking({ agencyId: viewer.agencyId, clientId: target.content.clientId, contentKeywordId, requestedById: viewer.userId }, getRankingConfig());
  await prisma.auditEvent.create({ data: { agencyId: viewer.agencyId, actorType: "USER", actorUserId: viewer.userId, action: "ranking.check_queued", targetType: "content", targetId: target.content.id } });
  revalidatePath(`/content/${target.content.id}`);
}

export async function updateRankingTargetAction(contentKeywordId: string, agencyId: string, formData: FormData): Promise<void> {
  const viewer = await requireViewer(agencyId); requirePermission(viewer.role, "ranking:write");
  const target = await prisma.contentKeyword.findFirst({ where: { id: contentKeywordId, content: { agencyId: viewer.agencyId, archivedAt: null } }, include: { content: { select: { id: true } } } });
  if (!target) throw new Error("NOT_FOUND");
  const frequency = Math.max(60, Math.min(43_200, Number(formData.get("frequency") ?? 1440)));
  const priority = Math.max(0, Math.min(100, Number(formData.get("priority") ?? 0)));
  const depth = Math.max(10, Math.min(100, Number(formData.get("depth") ?? 10)));
  const active = formData.get("active") === "on";
  await prisma.contentKeyword.update({ where: { id: target.id }, data: { checkFrequencyMinutes: frequency, priority, maxResultDepth: depth, active, nextCheckAt: active ? target.nextCheckAt : null } });
  await prisma.auditEvent.create({ data: { agencyId: viewer.agencyId, actorType: "USER", actorUserId: viewer.userId, action: "ranking.target_updated", targetType: "content", targetId: target.content.id, sanitizedData: { frequency, priority, depth, active } } });
  revalidatePath(`/content/${target.content.id}`);
}

export async function enqueueInspectionAction(contentId: string, agencyId: string): Promise<void> {
  const viewer = await requireViewer(agencyId); requirePermission(viewer.role, "inspection:write");
  const content = await prisma.content.findFirst({ where: { id: contentId, agencyId: viewer.agencyId, archivedAt: null }, select: { id: true, clientId: true } });
  if (!content) throw new Error("NOT_FOUND");
  await enqueueInspection({ agencyId: viewer.agencyId, clientId: content.clientId, contentId, requestedById: viewer.userId }, getInspectionConfig());
  await prisma.auditEvent.create({ data: { agencyId: viewer.agencyId, actorType: "USER", actorUserId: viewer.userId,
    action: "inspection.queued", targetType: "content", targetId: contentId } });
  revalidatePath(`/content/${contentId}`);
}

export async function retryInspectionAction(contentId: string, agencyId: string): Promise<void> {
  const viewer = await requireViewer(agencyId); requirePermission(viewer.role, "inspection:write");
  const content = await prisma.content.findFirst({ where: { id: contentId, agencyId: viewer.agencyId, archivedAt: null }, select: { id: true, clientId: true } });
  if (!content) throw new Error("NOT_FOUND");
  const active = await prisma.inspectionJob.findFirst({ where: { contentId, agencyId: viewer.agencyId, status: { in: ["PENDING", "RUNNING"] } }, select: { id: true } });
  if (active) { revalidatePath(`/content/${contentId}`); return; }
  await enqueueInspection({ agencyId: viewer.agencyId, clientId: content.clientId, contentId, requestedById: viewer.userId, force: true }, getInspectionConfig());
  await prisma.auditEvent.create({ data: { agencyId: viewer.agencyId, actorType: "USER", actorUserId: viewer.userId,
    action: "inspection.retry_queued", targetType: "content", targetId: contentId } });
  revalidatePath(`/content/${contentId}`);
}

function formObject(formData: FormData): Record<string, string> {
  return Object.fromEntries([...formData.entries()].filter(([, value]) => typeof value === "string")) as Record<string, string>;
}

export async function createClientAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = clientInputSchema.safeParse(formObject(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid client" };
  const viewer = await requireViewer(parsed.data.agencyId);
  requirePermission(viewer.role, "client:write");
  try {
    const client = await prisma.client.create({ data: {
      agencyId: viewer.agencyId, name: parsed.data.name, externalReference: parsed.data.externalReference || null,
      defaultCountryCode: parsed.data.defaultCountryCode, defaultLanguageCode: parsed.data.defaultLanguageCode,
      defaultDevice: parsed.data.defaultDevice,
    } });
    await prisma.auditEvent.create({ data: { agencyId: viewer.agencyId, actorType: "USER", actorUserId: viewer.userId,
      action: "client.created", targetType: "client", targetId: client.id, sanitizedData: { name: client.name } } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return { error: "A client with this name already exists" };
    throw error;
  }
  revalidatePath("/clients");
  redirect("/clients");
}

async function syncKeywords(tx: Prisma.TransactionClient, contentId: string, agencyId: string, keywords: string[], target: { countryCode: string; languageCode: string; device: "DESKTOP" | "MOBILE" }) {
  const phrases = [...new Set(keywords.map(normalizeKeyword).filter(Boolean))].slice(0, 50);
  const active = await tx.contentKeyword.findMany({ where: { contentId, active: true }, include: { keyword: true } });
  for (const prior of active) if (!phrases.includes(prior.keyword.normalizedPhrase) || prior.countryCode !== target.countryCode || prior.languageCode !== target.languageCode || prior.device !== target.device) {
    await tx.contentKeyword.update({ where: { id: prior.id }, data: { active: false, supersededAt: new Date(), nextCheckAt: null } });
  }
  for (const phrase of phrases) {
    const keyword = await tx.keyword.upsert({
      where: { agencyId_normalizedPhrase: { agencyId, normalizedPhrase: phrase } },
      create: { agencyId, normalizedPhrase: phrase, displayPhrase: phrase }, update: {},
    });
    const existing = active.find((entry) => entry.keywordId === keyword.id && entry.countryCode === target.countryCode && entry.languageCode === target.languageCode && entry.device === target.device);
    if (!existing) {
      const latest = await tx.contentKeyword.findFirst({ where: { contentId, keywordId: keyword.id, ...target }, orderBy: { version: "desc" }, select: { version: true } });
      await tx.contentKeyword.create({ data: { contentId, keywordId: keyword.id, ...target, version: (latest?.version ?? 0) + 1 } });
    }
  }
}

export async function createContentAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = contentInputSchema.safeParse(formObject(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid content" };
  const viewer = await requireViewer(parsed.data.agencyId);
  requirePermission(viewer.role, "content:write");
  let normalized: ReturnType<typeof normalizeContentUrl>;
  try { normalized = normalizeContentUrl(parsed.data.originalUrl); }
  catch (error) { return { error: error instanceof Error ? error.message : "Invalid URL" }; }
  const client = await prisma.client.findFirst({ where: { id: parsed.data.clientId, agencyId: viewer.agencyId, active: true } });
  if (!client) return { error: "Client not found" };
  if (parsed.data.publisherAccountId) {
    const account = await prisma.publisherAccount.findFirst({ where: { id: parsed.data.publisherAccountId, agencyId: viewer.agencyId, clientId: client.id } });
    if (!account) return { error: "Publisher account not found for this client" };
  }
  try {
    const content = await prisma.$transaction(async (tx) => {
      const created = await tx.content.create({ data: {
        agencyId: viewer.agencyId, clientId: client.id, publisherAccountId: parsed.data.publisherAccountId,
        originalUrl: normalized.originalUrl, normalizedUrl: normalized.normalizedUrl, dedupeHash: normalized.dedupeHash,
        normalizationVersion: NORMALIZATION_VERSION, platform: normalized.platform, contentType: normalized.contentType,
        title: parsed.data.title || null, description: parsed.data.description || null,
        publishedAt: parsed.data.publishedAt ? new Date(`${parsed.data.publishedAt}T00:00:00.000Z`) : null,
        publicationStatus: parsed.data.publicationStatus,
      } });
      await syncKeywords(tx, created.id, viewer.agencyId, parsed.data.keywords.split(/[|;,]/), {
        countryCode: parsed.data.countryCode, languageCode: parsed.data.languageCode, device: parsed.data.device,
      });
      await tx.statusHistory.create({ data: { agencyId: viewer.agencyId, entityType: "content", entityId: created.id,
        statusDimension: "publication", newValue: created.publicationStatus, reason: "Content created", actorType: "USER", actorId: viewer.userId } });
      await tx.auditEvent.create({ data: { agencyId: viewer.agencyId, actorType: "USER", actorUserId: viewer.userId,
        action: "content.created", targetType: "content", targetId: created.id, sanitizedData: { platform: created.platform, contentType: created.contentType } } });
      return created;
    });
    redirect(`/content/${content.id}`);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return { error: "This URL already exists for the selected client" };
    throw error;
  }
}

export async function updateContentAction(id: string, _state: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = contentInputSchema.safeParse(formObject(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid content" };
  const viewer = await requireViewer(parsed.data.agencyId);
  requirePermission(viewer.role, "content:write");
  const existing = await prisma.content.findFirst({ where: { id, agencyId: viewer.agencyId, archivedAt: null } });
  if (!existing) return { error: "Content not found" };
  let normalized: ReturnType<typeof normalizeContentUrl>;
  try { normalized = normalizeContentUrl(parsed.data.originalUrl); }
  catch (error) { return { error: error instanceof Error ? error.message : "Invalid URL" }; }
  const client = await prisma.client.findFirst({ where: { id: parsed.data.clientId, agencyId: viewer.agencyId, active: true } });
  if (!client) return { error: "Client not found" };
  if (parsed.data.publisherAccountId) {
    const account = await prisma.publisherAccount.findFirst({ where: { id: parsed.data.publisherAccountId, agencyId: viewer.agencyId, clientId: client.id } });
    if (!account) return { error: "Publisher account not found for this client" };
  }
  try {
    await prisma.$transaction(async (tx) => {
      await tx.content.update({ where: { id }, data: {
        clientId: client.id, publisherAccountId: parsed.data.publisherAccountId,
        originalUrl: normalized.originalUrl, normalizedUrl: normalized.normalizedUrl, dedupeHash: normalized.dedupeHash,
        platform: normalized.platform, contentType: normalized.contentType, title: parsed.data.title || null,
        description: parsed.data.description || null, publishedAt: parsed.data.publishedAt ? new Date(`${parsed.data.publishedAt}T00:00:00.000Z`) : null,
        publicationStatus: parsed.data.publicationStatus,
      } });
      await syncKeywords(tx, id, viewer.agencyId, parsed.data.keywords.split(/[|;,]/), {
        countryCode: parsed.data.countryCode, languageCode: parsed.data.languageCode, device: parsed.data.device,
      });
      if (existing.publicationStatus !== parsed.data.publicationStatus) await tx.statusHistory.create({ data: {
        agencyId: viewer.agencyId, entityType: "content", entityId: id, statusDimension: "publication",
        previousValue: existing.publicationStatus, newValue: parsed.data.publicationStatus,
        reason: "Editorial update", actorType: "USER", actorId: viewer.userId,
      } });
      await tx.auditEvent.create({ data: { agencyId: viewer.agencyId, actorType: "USER", actorUserId: viewer.userId,
        action: "content.updated", targetType: "content", targetId: id } });
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return { error: "This URL already exists for the selected client" };
    throw error;
  }
  revalidatePath(`/content/${id}`);
  redirect(`/content/${id}`);
}

export async function archiveContentAction(id: string, agencyId: string): Promise<void> {
  const viewer = await requireViewer(agencyId);
  requirePermission(viewer.role, "content:write");
  const changed = await prisma.content.updateMany({ where: { id, agencyId: viewer.agencyId, archivedAt: null }, data: { archivedAt: new Date() } });
  if (changed.count) await prisma.$transaction([
    prisma.statusHistory.create({ data: { agencyId: viewer.agencyId, entityType: "content", entityId: id,
      statusDimension: "lifecycle", newValue: "ARCHIVED", reason: "Content archived", actorType: "USER", actorId: viewer.userId } }),
    prisma.auditEvent.create({ data: { agencyId: viewer.agencyId, actorType: "USER", actorUserId: viewer.userId,
      action: "content.archived", targetType: "content", targetId: id } }),
  ]);
  redirect("/content");
}

async function createImportPreview(input: {
  agencyId: string;
  clientId: string;
  createdById: string;
  originalFilename: string;
  idempotencyKey: string;
  sourceRows: ImportSourceRow[];
  mapping: CsvMapping;
  defaults: { country: string; language: string; device: "DESKTOP" | "MOBILE" };
}): Promise<string> {
  const existingBatch = await prisma.importBatch.findUnique({
    where: { agencyId_clientId_idempotencyKey: { agencyId: input.agencyId, clientId: input.clientId, idempotencyKey: input.idempotencyKey } },
    select: { id: true },
  });
  if (existingBatch) return existingBatch.id;

  const existingHashes = new Set((await prisma.content.findMany({
    where: { clientId: input.clientId, agencyId: input.agencyId }, select: { dedupeHash: true },
  })).map((item) => item.dedupeHash));
  const rows = buildPreviewRows(input.sourceRows, input.mapping, input.defaults, existingHashes);
  const counts = {
    valid: rows.filter((row) => row.status === "VALID").length,
    duplicate: rows.filter((row) => row.status === "DUPLICATE").length,
    rejected: rows.filter((row) => row.status === "REJECTED").length,
  };
  const batch = await prisma.importBatch.create({ data: {
    agencyId: input.agencyId, clientId: input.clientId, idempotencyKey: input.idempotencyKey,
    originalFilename: input.originalFilename.slice(0, 255), createdById: input.createdById,
    totalRows: rows.length, validRows: counts.valid, duplicateRows: counts.duplicate, rejectedRows: counts.rejected,
    rows: { createMany: { data: rows } },
  } });
  return batch.id;
}

export async function previewImportAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const agencyId = String(formData.get("agencyId") ?? "");
  const clientId = String(formData.get("clientId") ?? "");
  const viewer = await requireViewer(agencyId);
  requirePermission(viewer.role, "content:write");
  const client = await prisma.client.findFirst({ where: { id: clientId, agencyId: viewer.agencyId, active: true } });
  if (!client) return { error: "Client not found" };
  const file = formData.get("file");
  if (!(file instanceof File) || !file.name.toLowerCase().endsWith(".csv")) return { error: "Choose a CSV file" };
  if (file.size > MAX_CSV_BYTES) return { error: "CSV exceeds the 5 MB limit" };
  const mapping = csvMappingSchema.safeParse({
    url: String(formData.get("mapUrl") ?? ""), title: String(formData.get("mapTitle") ?? "") || undefined,
    description: String(formData.get("mapDescription") ?? "") || undefined, publishedAt: String(formData.get("mapPublishedAt") ?? "") || undefined,
    keywords: String(formData.get("mapKeywords") ?? "") || undefined, country: String(formData.get("mapCountry") ?? "") || undefined,
    language: String(formData.get("mapLanguage") ?? "") || undefined, device: String(formData.get("mapDevice") ?? "") || undefined,
    publicationStatus: String(formData.get("mapPublicationStatus") ?? "") || undefined,
  });
  if (!mapping.success) return { error: "URL column mapping is required" };
  const bytes = Buffer.from(await file.arrayBuffer());
  let document;
  try { document = parseCsv(bytes.toString("utf8")); }
  catch (error) { return { error: error instanceof Error ? error.message : "Invalid CSV" }; }
  if (!document.headers.includes(mapping.data.url)) return { error: "Mapped URL column was not found" };
  const batchId = await createImportPreview({
    agencyId, clientId, createdById: viewer.userId, originalFilename: file.name,
    idempotencyKey: createHash("sha256").update(bytes).update(JSON.stringify(mapping.data)).digest("hex"),
    sourceRows: document.rows.map((rawData, index) => ({ rowNumber: index + 2, rawData })), mapping: mapping.data,
    defaults: { country: client.defaultCountryCode ?? "US", language: client.defaultLanguageCode ?? "en", device: client.defaultDevice },
  });
  redirect(`/imports/${batchId}`);
}

export async function previewPastedUrlsAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const agencyId = String(formData.get("agencyId") ?? "");
  const clientId = String(formData.get("clientId") ?? "");
  const viewer = await requireViewer(agencyId);
  requirePermission(viewer.role, "content:write");
  const client = await prisma.client.findFirst({ where: { id: clientId, agencyId: viewer.agencyId, active: true } });
  if (!client) return { error: "Client not found" };

  let sourceRows: ImportSourceRow[];
  try { sourceRows = parsePastedUrls(String(formData.get("urls") ?? "")); }
  catch (error) { return { error: error instanceof Error ? error.message : "Invalid URL list" }; }

  const mapping = csvMappingSchema.parse({ url: "url" });
  const canonicalInput = sourceRows.map((row) => String(row.rawData.url)).join("\n");
  const batchId = await createImportPreview({
    agencyId, clientId, createdById: viewer.userId, originalFilename: `Pasted URLs (${sourceRows.length})`,
    idempotencyKey: createHash("sha256").update("paste\0").update(canonicalInput).digest("hex"),
    sourceRows, mapping,
    defaults: { country: client.defaultCountryCode ?? "US", language: client.defaultLanguageCode ?? "en", device: client.defaultDevice },
  });
  redirect(`/imports/${batchId}`);
}

export async function confirmImportAction(batchId: string, agencyId: string): Promise<void> {
  const viewer = await requireViewer(agencyId);
  requirePermission(viewer.role, "content:write");
  await prisma.$transaction(async (tx) => {
    const batch = await tx.importBatch.findFirst({ where: { id: batchId, agencyId: viewer.agencyId }, include: { rows: { where: { status: "VALID" }, orderBy: { rowNumber: "asc" } } } });
    if (!batch || batch.status !== "PREVIEWED") return;
    await tx.importBatch.update({ where: { id: batch.id }, data: { status: "IMPORTING" } });
    let imported = 0;
    let newlyDuplicated = 0;
    for (const row of batch.rows) {
      const data = row.normalizedData as unknown as ValidatedImportRow;
      try {
        const content = await tx.content.create({ data: {
          agencyId: viewer.agencyId, clientId: batch.clientId, originalUrl: data.normalized.originalUrl,
          normalizedUrl: data.normalized.normalizedUrl, dedupeHash: data.normalized.dedupeHash, normalizationVersion: NORMALIZATION_VERSION,
          platform: data.normalized.platform, contentType: data.normalized.contentType, title: data.title ?? null,
          description: data.description ?? null, publishedAt: data.publishedAt ? new Date(data.publishedAt) : null,
          publicationStatus: data.publicationStatus,
        } });
        await syncKeywords(tx, content.id, viewer.agencyId, data.keywords, { countryCode: data.countryCode, languageCode: data.languageCode, device: data.device });
        await tx.importRow.update({ where: { id: row.id }, data: { status: "IMPORTED", contentId: content.id } });
        await tx.statusHistory.create({ data: { agencyId: viewer.agencyId, entityType: "content", entityId: content.id,
          statusDimension: "publication", newValue: content.publicationStatus, reason: "Confirmed import", actorType: "USER", actorId: viewer.userId } });
        imported += 1;
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
          await tx.importRow.update({ where: { id: row.id }, data: { status: "DUPLICATE", rejectionReason: "URL was imported previously" } });
          newlyDuplicated += 1;
        } else throw error;
      }
    }
    await tx.importBatch.update({ where: { id: batch.id }, data: { status: "COMPLETED", importedRows: imported,
      duplicateRows: { increment: newlyDuplicated }, validRows: { decrement: newlyDuplicated }, completedAt: new Date() } });
    await tx.auditEvent.create({ data: { agencyId: viewer.agencyId, actorType: "USER", actorUserId: viewer.userId,
      action: "import.completed", targetType: "import_batch", targetId: batch.id, sanitizedData: { importedRows: imported } } });
  }, { timeout: 60_000 });
  const inspectionConfig = getInspectionConfig();
  if (inspectionConfig.AUTO_INSPECT_CONFIRMED_IMPORTS) {
    const imported = await prisma.importRow.findMany({ where: { importBatchId: batchId, status: "IMPORTED", importBatch: { agencyId: viewer.agencyId } }, select: { content: { select: { id: true, clientId: true } } } });
    const grouped = new Map<string, Array<{ id: string; clientId: string }>>();
    for (const row of imported) if (row.content) grouped.set(row.content.clientId, [...(grouped.get(row.content.clientId) ?? []), row.content]);
    let scheduled = 0;
    for (const [clientId, contents] of grouped) scheduled += await scheduleImportedInspections({ agencyId: viewer.agencyId, clientId, contentIds: contents.map((content) => content.id), requestedById: viewer.userId }, inspectionConfig);
    await prisma.auditEvent.create({ data: { agencyId: viewer.agencyId, actorType: "SYSTEM", action: "import.inspections_scheduled", targetType: "import_batch", targetId: batchId, sanitizedData: { scheduled } } });
  }
  revalidatePath("/imports");
  redirect(`/imports/${batchId}`);
}
