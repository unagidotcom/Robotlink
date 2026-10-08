import { z } from "zod";
const schema = z.object({
  RANKING_WORKER_ID: z.string().min(3).max(200).default(`ranking-${process.pid}`),
  RANKING_GLOBAL_CONCURRENCY: z.coerce.number().int().min(1).max(20).default(2),
  RANKING_LEASE_SECONDS: z.coerce.number().int().min(30).max(1800).default(180),
  RANKING_POLL_MS: z.coerce.number().int().min(500).max(60000).default(3000),
  RANKING_QUEUE_LIMIT_PER_CLIENT: z.coerce.number().int().min(10).max(10000).default(500),
  RANKING_GLOBAL_DAILY_LIMIT_MINOR: z.coerce.bigint().min(0n).default(1000n),
  DATAFORSEO_EXECUTION_ENABLED: z.enum(["true", "false"]).default("false").transform((v) => v === "true"),
  DATAFORSEO_LOGIN: z.string().optional(), DATAFORSEO_PASSWORD: z.string().optional(),
  DATAFORSEO_TOP10_ESTIMATED_MINOR: z.coerce.bigint().min(0n).default(1n),
  DATAFORSEO_LOCATION_CODES_JSON: z.string().default('{"US":2840,"GB":2826,"IN":2356}'),
});
export type RankingConfig = z.infer<typeof schema>;
export function getRankingConfig(source: Record<string, string | undefined> = process.env): RankingConfig { const value = schema.safeParse(source); if (!value.success) throw new Error(`Invalid ranking environment: ${value.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`); return value.data; }
export function locationCode(config: RankingConfig, country: string): number | undefined { const map = JSON.parse(config.DATAFORSEO_LOCATION_CODES_JSON) as Record<string, number>; return map[country.toUpperCase()]; }
