import type { AuditActorType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export interface AuditInput {
  agencyId: string;
  actorType: AuditActorType;
  actorUserId?: string;
  action: string;
  targetType: string;
  targetId?: string;
  sanitizedData?: Prisma.InputJsonValue;
  correlationId?: string;
}

export async function recordAuditEvent(input: AuditInput): Promise<void> {
  await prisma.auditEvent.create({ data: input });
}

export interface StatusChangeInput {
  agencyId: string;
  entityType: string;
  entityId: string;
  statusDimension: string;
  previousValue?: string;
  newValue: string;
  reason?: string;
  evidenceType?: string;
  evidenceId?: string;
  actorType: AuditActorType;
  actorId?: string;
  correlationId?: string;
}

export async function recordStatusChange(input: StatusChangeInput): Promise<void> {
  await prisma.statusHistory.create({ data: input });
}
