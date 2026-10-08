import type { AgencyRole } from "@prisma/client";

export type Permission =
  | "agency:manage"
  | "client:read"
  | "client:write"
  | "content:read"
  | "content:write"
  | "inspection:write"
  | "audit:read"
  | "budget:manage";

const permissions: Record<AgencyRole, ReadonlySet<Permission>> = {
  OWNER: new Set(["agency:manage", "client:read", "client:write", "content:read", "content:write", "inspection:write", "audit:read", "budget:manage"]),
  ADMINISTRATOR: new Set(["client:read", "client:write", "content:read", "content:write", "inspection:write", "audit:read", "budget:manage"]),
  STRATEGIST: new Set(["client:read", "content:read", "content:write", "inspection:write", "audit:read"]),
  ANALYST: new Set(["client:read", "content:read", "audit:read"]),
  VIEWER: new Set(["client:read", "content:read"]),
};

export function hasPermission(role: AgencyRole, permission: Permission): boolean {
  return permissions[role].has(permission);
}

export function requirePermission(role: AgencyRole, permission: Permission): void {
  if (!hasPermission(role, permission)) throw new Error("FORBIDDEN");
}

export function requireAgencyMembership<T extends { agencyId: string }>(resource: T, agencyId: string): T {
  if (resource.agencyId !== agencyId) throw new Error("NOT_FOUND");
  return resource;
}
