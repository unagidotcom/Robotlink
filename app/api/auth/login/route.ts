import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { loginSchema } from "@/lib/validation/auth";
import { verifyPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { hasTrustedOrigin } from "@/lib/auth/request-security";
import { clearLoginFailures, isLoginBlocked, recordLoginFailure } from "@/lib/auth/throttle";

export async function POST(request: Request) {
  if (!hasTrustedOrigin(request)) return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
  const body: unknown = await request.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid credentials" }, { status: 400 });
  if (await isLoginBlocked(parsed.data.email)) {
    return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 });
  }
  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (!user || user.disabledAt || !(await verifyPassword(parsed.data.password, user.passwordHash))) {
    await recordLoginFailure(parsed.data.email);
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }
  await clearLoginFailures(parsed.data.email);
  await createSession(user.id);
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  return NextResponse.json({ ok: true });
}
