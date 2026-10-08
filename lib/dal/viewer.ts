import "server-only";
import { redirect } from "next/navigation";
import { getAuthenticatedUser } from "@/lib/auth/session";
import type { AgencyRole } from "@prisma/client";

export interface Viewer {
  userId: string;
  email: string;
  agencyId: string;
  agencyName: string;
  role: AgencyRole;
}

export async function requireViewer(requestedAgencyId?: string): Promise<Viewer> {
  const user = await getAuthenticatedUser();
  if (!user) redirect("/login");
  const membership = requestedAgencyId
    ? user.memberships.find((entry) => entry.agencyId === requestedAgencyId)
    : user.memberships[0];
  if (!membership) redirect("/login?error=no-agency");
  const agency = await import("@/lib/prisma").then(({ prisma }) => prisma.agency.findUnique({
    where: { id: membership.agencyId }, select: { id: true, name: true },
  }));
  if (!agency) redirect("/login?error=no-agency");
  return { userId: user.id, email: user.email, agencyId: agency.id, agencyName: agency.name, role: membership.role };
}
