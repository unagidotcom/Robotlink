import { z } from "zod";
import type { EstimatedCost, ProviderOperationContext, RankingProvider, RankingRequest, RankingResult } from "./types";

const responseSchema = z.object({ tasks: z.array(z.object({ id: z.string().optional(), status_code: z.number(), status_message: z.string().optional(), cost: z.number().optional(), result: z.array(z.object({ datetime: z.string().optional(), items: z.array(z.object({ type: z.string(), rank_absolute: z.number().optional(), url: z.string().optional(), title: z.string().optional() })).nullable().optional() })).nullable().optional() })) });
export function parseDataForSeoResponse(payload: unknown): RankingResult {
  const parsed = responseSchema.parse(payload); const task = parsed.tasks[0];
  if (!task || task.status_code >= 40000 || !task.result?.[0]) throw new Error(`PROVIDER_ERROR:${task?.status_code ?? "EMPTY"}`);
  const result = task.result[0];
  return { observedAt: result.datetime ? new Date(result.datetime.replace(" ", "T").replace(" +", "+")) : new Date(), providerRequestId: task.id,
    actualCostMinor: task.cost === undefined ? undefined : BigInt(Math.round(task.cost * 100)), currency: "USD",
    results: (result.items ?? []).filter((item) => item.type === "organic" && item.url && item.rank_absolute).map((item) => ({ position: item.rank_absolute!, url: item.url!, title: item.title })) };
}

export class DataForSeoProvider implements RankingProvider {
  readonly code = "dataforseo";
  constructor(private readonly options: { login?: string; password?: string; enabled: boolean; estimatedTop10Minor: bigint; fetcher?: typeof fetch }) {}
  async estimate(request: RankingRequest): Promise<EstimatedCost> { return { amountMinor: this.options.estimatedTop10Minor * BigInt(Math.max(1, Math.ceil(request.depth / 10))), currency: "USD", units: 1 }; }
  async execute(request: RankingRequest, context: ProviderOperationContext): Promise<RankingResult> {
    if (!this.options.enabled) throw new Error("PAID_PROVIDER_DISABLED");
    if (!this.options.login || !this.options.password) throw new Error("PROVIDER_CREDENTIALS_MISSING");
    if (!request.locationCode) throw new Error("LOCATION_CODE_REQUIRED");
    const response = await (this.options.fetcher ?? fetch)("https://api.dataforseo.com/v3/serp/google/organic/live/advanced", { method: "POST",
      headers: { authorization: `Basic ${Buffer.from(`${this.options.login}:${this.options.password}`).toString("base64")}`, "content-type": "application/json" },
      body: JSON.stringify([{ keyword: request.keyword, location_code: request.locationCode, language_code: request.languageCode, device: request.device, depth: request.depth, tag: context.correlationId }]) });
    if (!response.ok) throw new Error(`PROVIDER_HTTP_${response.status}`);
    return parseDataForSeoResponse(await response.json());
  }
}
