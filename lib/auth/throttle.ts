import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";

const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 5;

function keyFor(email: string): string {
  return createHash("sha256").update(email).digest("hex");
}

export async function isLoginBlocked(email: string, now = new Date()): Promise<boolean> {
  const throttle = await prisma.loginThrottle.findUnique({ where: { keyHash: keyFor(email) } });
  return Boolean(throttle?.blockedUntil && throttle.blockedUntil > now);
}

export async function recordLoginFailure(email: string, now = new Date()): Promise<void> {
  const keyHash = keyFor(email);
  const existing = await prisma.loginThrottle.findUnique({ where: { keyHash } });
  const resetWindow = !existing || now.getTime() - existing.windowStarted.getTime() > WINDOW_MS;
  const failureCount = resetWindow ? 1 : existing.failureCount + 1;
  await prisma.loginThrottle.upsert({
    where: { keyHash },
    create: { keyHash, failureCount, windowStarted: now, blockedUntil: failureCount >= MAX_FAILURES ? new Date(now.getTime() + WINDOW_MS) : null },
    update: { failureCount, windowStarted: resetWindow ? now : existing.windowStarted, blockedUntil: failureCount >= MAX_FAILURES ? new Date(now.getTime() + WINDOW_MS) : null },
  });
}

export async function clearLoginFailures(email: string): Promise<void> {
  await prisma.loginThrottle.deleteMany({ where: { keyHash: keyFor(email) } });
}
