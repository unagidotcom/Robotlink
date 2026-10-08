import { z } from "zod";

const workerSchema = z.object({
  INSPECTION_WORKER_ID: z.string().min(3).max(200).default(`worker-${process.pid}`),
  INSPECTION_GLOBAL_CONCURRENCY: z.coerce.number().int().min(1).max(20).default(4),
  INSPECTION_PER_CLIENT_CONCURRENCY: z.coerce.number().int().min(1).max(10).default(2),
  INSPECTION_QUEUE_LIMIT_PER_CLIENT: z.coerce.number().int().min(10).max(10000).default(500),
  INSPECTION_LEASE_SECONDS: z.coerce.number().int().min(30).max(1800).default(180),
  INSPECTION_POLL_MS: z.coerce.number().int().min(250).max(60000).default(2000),
  INSPECTION_ORIGIN_DELAY_MS: z.coerce.number().int().min(250).max(60000).default(1500),
  INSPECTION_CONNECT_TIMEOUT_MS: z.coerce.number().int().min(500).max(30000).default(5000),
  INSPECTION_TOTAL_TIMEOUT_MS: z.coerce.number().int().min(1000).max(120000).default(15000),
  INSPECTION_MAX_BYTES: z.coerce.number().int().min(1024).max(10_000_000).default(2_000_000),
  INSPECTION_MAX_REDIRECTS: z.coerce.number().int().min(0).max(10).default(5),
  INSPECTION_EVIDENCE_TTL_HOURS: z.coerce.number().int().min(1).max(2160).default(168),
  INSPECTION_USER_AGENT: z.string().min(10).max(300).default("RobotlinkTechnicalInspector/1.0 (+https://robotlink.invalid/inspector)"),
});

export type InspectionConfig = z.infer<typeof workerSchema>;
export function getInspectionConfig(source: Record<string, string | undefined> = process.env): InspectionConfig {
  const result = workerSchema.safeParse(source);
  if (!result.success) throw new Error(`Invalid inspection environment: ${result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`);
  return result.data;
}
