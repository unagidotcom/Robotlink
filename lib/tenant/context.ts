import type { AgencyRole } from "@prisma/client";
import { getAuthenticatedUser } from "@/lib/auth/session";

export interface TenantContext {
  userId: string;
  agencyId: string;
  role: AgencyRole;
}

export async function requireTenantContext(agencyId: string): Promise<TenantContext> {
  const user = await getAuthenticatedUser();
  if (!user) throw new Error("UNAUTHENTICATED");
  const membership = user.memberships.find((candidate) => candidate.agencyId === agencyId);
  if (!membership) throw new Error("NOT_FOUND");
  return { userId: user.id, agencyId, role: membership.role };
}

export function tenantWhere<T extends object>(context: TenantContext, where?: T): Omit<T, "agencyId"> & { agencyId: string } {
  return { ...where, agencyId: context.agencyId } as Omit<T, "agencyId"> & { agencyId: string };
}
