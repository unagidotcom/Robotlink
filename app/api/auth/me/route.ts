import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth/session";

export async function GET() {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  return NextResponse.json({
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    memberships: user.memberships.map(({ agencyId, role }) => ({ agencyId, role })),
  });
}
