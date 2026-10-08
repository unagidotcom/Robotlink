import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().url().startsWith("postgresql://"),
  SESSION_COOKIE_NAME: z.string().regex(/^[A-Za-z0-9_-]+$/).default("seo_session"),
  SESSION_TTL_HOURS: z.coerce.number().int().min(1).max(168).default(12),
  APP_ORIGIN: z.string().url(),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  WORKERS_ENABLED: z.enum(["true", "false"]).default("false").transform((value) => value === "true"),
});

export type AppEnv = z.infer<typeof schema>;

let cached: AppEnv | undefined;

export function getEnv(source: Record<string, string | undefined> = process.env): AppEnv {
  if (source === process.env && cached) return cached;
  const result = schema.safeParse(source);
  if (!result.success) {
    const message = result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ");
    throw new Error(`Invalid environment: ${message}`);
  }
  if (source === process.env) cached = result.data;
  return result.data;
}
