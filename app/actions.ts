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
import { csvMappingSchema, validateImportRow, type ValidatedImportRow } from "@/lib/imports/validation";
import { MAX_CSV_BYTES, parseCsv } from "@/lib/imports/csv";
import { getInspectionConfig } from "@/lib/inspection/config";
import { enqueueInspection } from "@/lib/inspection/queue";

export type ActionState = { ok?: boolean; error?: string; batchId?: string };

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
  await tx.contentKeyword.deleteMany({ where: { contentId } });
  for (const phrase of [...new Set(keywords.map(normalizeKeyword).filter(Boolean))].slice(0, 50)) {
    const keyword = await tx.keyword.upsert({
      where: { agencyId_normalizedPhrase: { agencyId, normalizedPhrase: phrase } },
      create: { agencyId, normalizedPhrase: phrase, displayPhrase: phrase }, update: {},
    });
    await tx.contentKeyword.create({ data: { contentId, keywordId: keyword.id, ...target } });
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

function importJson(row: ValidatedImportRow): Prisma.InputJsonValue {
  return { ...row, normalized: row.normalized } as unknown as Prisma.InputJsonValue;
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
  const idempotencyKey = createHash("sha256").update(bytes).update(JSON.stringify(mapping.data)).digest("hex");
  const existingBatch = await prisma.importBatch.findUnique({ where: { agencyId_clientId_idempotencyKey: { agencyId, clientId, idempotencyKey } } });
  if (existingBatch) return { ok: true, batchId: existingBatch.id };
  const seen = new Set<string>();
  const existingHashes = new Set((await prisma.content.findMany({ where: { clientId, agencyId }, select: { dedupeHash: true } })).map((item) => item.dedupeHash));
  const rows = document.rows.map((rawData, index) => {
    try {
      const normalizedData = validateImportRow(rawData, mapping.data, {
        country: client.defaultCountryCode ?? "US", language: client.defaultLanguageCode ?? "en", device: client.defaultDevice,
      });
      const duplicate = existingHashes.has(normalizedData.normalized.dedupeHash) || seen.has(normalizedData.normalized.dedupeHash);
      seen.add(normalizedData.normalized.dedupeHash);
      return { rowNumber: index + 2, status: duplicate ? "DUPLICATE" as const : "VALID" as const,
        rawData: rawData as Prisma.InputJsonValue, normalizedData: importJson(normalizedData), dedupeHash: normalizedData.normalized.dedupeHash,
        rejectionReason: duplicate ? "Duplicate URL within this client" : null };
    } catch (error) {
      return { rowNumber: index + 2, status: "REJECTED" as const, rawData: rawData as Prisma.InputJsonValue,
        normalizedData: Prisma.JsonNull, dedupeHash: null, rejectionReason: error instanceof Error ? error.message : "Invalid row" };
    }
  });
  const counts = { valid: rows.filter((row) => row.status === "VALID").length, duplicate: rows.filter((row) => row.status === "DUPLICATE").length, rejected: rows.filter((row) => row.status === "REJECTED").length };
  const batch = await prisma.importBatch.create({ data: {
    agencyId, clientId, idempotencyKey, originalFilename: file.name.slice(0, 255), createdById: viewer.userId,
    totalRows: rows.length, validRows: counts.valid, duplicateRows: counts.duplicate, rejectedRows: counts.rejected,
    rows: { createMany: { data: rows } },
  } });
  redirect(`/imports/${batch.id}`);
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
          statusDimension: "publication", newValue: content.publicationStatus, reason: "CSV import", actorType: "USER", actorId: viewer.userId } });
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
  revalidatePath("/imports");
  redirect(`/imports/${batchId}`);
}
