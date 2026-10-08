import "server-only";
import { prisma } from "@/lib/prisma";
import type { Viewer } from "./viewer";

export async function listClients(viewer: Viewer) {
  return prisma.client.findMany({
    where: { agencyId: viewer.agencyId },
    select: { id: true, name: true, active: true, defaultCountryCode: true, defaultLanguageCode: true, defaultDevice: true },
    orderBy: { name: "asc" },
  });
}

export async function listContent(viewer: Viewer, filters: { clientId?: string; platform?: string; type?: string; query?: string }) {
  return prisma.content.findMany({
    where: {
      agencyId: viewer.agencyId,
      archivedAt: null,
      ...(filters.clientId ? { clientId: filters.clientId } : {}),
      ...(filters.platform ? { platform: filters.platform as never } : {}),
      ...(filters.type ? { contentType: filters.type as never } : {}),
      ...(filters.query ? { OR: [
        { title: { contains: filters.query, mode: "insensitive" } },
        { originalUrl: { contains: filters.query, mode: "insensitive" } },
        { keywords: { some: { keyword: { displayPhrase: { contains: filters.query, mode: "insensitive" } } } } },
      ] } : {}),
    },
    select: {
      id: true, title: true, originalUrl: true, platform: true, contentType: true,
      publicationStatus: true, technicalStatus: true, indexingEvidence: true,
      visibilityStatus: true, revenueAvailability: true, lastVerifiedAt: true,
      client: { select: { name: true } },
      keywords: { select: { keyword: { select: { displayPhrase: true } } }, take: 4 },
    },
    orderBy: { updatedAt: "desc" },
    take: 250,
  });
}

export async function getContentDetail(viewer: Viewer, id: string) {
  return prisma.content.findFirst({
    where: { id, agencyId: viewer.agencyId, archivedAt: null },
    include: {
      client: { select: { id: true, name: true } },
      publisherAccount: { select: { id: true, displayName: true, platform: true } },
      keywords: { include: { keyword: true }, orderBy: { keyword: { displayPhrase: "asc" } } },
      permissions: true,
    },
  });
}

export async function dashboardSummary(viewer: Viewer) {
  const [contentCount, clientCount, unknownTechnical, unknownIndexing, recent] = await Promise.all([
    prisma.content.count({ where: { agencyId: viewer.agencyId, archivedAt: null } }),
    prisma.client.count({ where: { agencyId: viewer.agencyId, active: true } }),
    prisma.content.count({ where: { agencyId: viewer.agencyId, archivedAt: null, technicalStatus: "UNKNOWN" } }),
    prisma.content.count({ where: { agencyId: viewer.agencyId, archivedAt: null, indexingEvidence: "UNKNOWN" } }),
    prisma.auditEvent.findMany({ where: { agencyId: viewer.agencyId }, orderBy: { occurredAt: "desc" }, take: 8,
      select: { id: true, action: true, targetType: true, occurredAt: true } }),
  ]);
  return { contentCount, clientCount, unknownTechnical, unknownIndexing, recent };
}
