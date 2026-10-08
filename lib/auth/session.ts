import { createHash, randomBytes } from "node:crypto";
import { cookies, headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getEnv } from "@/lib/env";

export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(userId: string): Promise<string> {
  const env = getEnv();
  const token = randomBytes(32).toString("base64url");
  const requestHeaders = await headers();
  await prisma.session.create({
    data: {
      userId,
      tokenHash: hashSessionToken(token),
      expiresAt: new Date(Date.now() + env.SESSION_TTL_HOURS * 60 * 60 * 1000),
      userAgent: requestHeaders.get("user-agent")?.slice(0, 500),
    },
  });
  const cookieStore = await cookies();
  cookieStore.set(env.SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: env.SESSION_TTL_HOURS * 60 * 60,
  });
  return token;
}

export async function getAuthenticatedUser() {
  const env = getEnv();
  const token = (await cookies()).get(env.SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  return getUserForSessionToken(token);
}

export async function getUserForSessionToken(token: string, now = new Date()) {
  const session = await prisma.session.findUnique({
    where: { tokenHash: hashSessionToken(token) },
    include: { user: { include: { memberships: true } } },
  });
  if (!session || session.endedAt || session.expiresAt <= now || session.user.disabledAt) return null;
  return session.user;
}

export async function revokeCurrentSession(): Promise<void> {
  const env = getEnv();
  const cookieStore = await cookies();
  const token = cookieStore.get(env.SESSION_COOKIE_NAME)?.value;
  if (token) {
    await prisma.session.updateMany({
      where: { tokenHash: hashSessionToken(token), endedAt: null },
      data: { endedAt: new Date(), endReason: "LOGOUT" },
    });
  }
  cookieStore.delete(env.SESSION_COOKIE_NAME);
}
