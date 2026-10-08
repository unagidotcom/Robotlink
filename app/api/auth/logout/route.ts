import { NextResponse } from "next/server";
import { revokeCurrentSession } from "@/lib/auth/session";
import { hasTrustedOrigin } from "@/lib/auth/request-security";

export async function POST(request: Request) {
  if (!hasTrustedOrigin(request)) return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
  await revokeCurrentSession();
  return NextResponse.json({ ok: true });
}
