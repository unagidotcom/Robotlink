import { getEnv } from "@/lib/env";

export function hasTrustedOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  return origin === getEnv().APP_ORIGIN;
}
