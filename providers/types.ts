export interface ProviderOperationContext {
  agencyId: string;
  clientId?: string;
  idempotencyKey: string;
  correlationId: string;
}

export interface EstimatedCost {
  amountMinor: bigint;
  currency: string;
  units: number;
}

export interface MonitoringProvider<TRequest, TResult> {
  readonly code: string;
  estimate(request: TRequest): Promise<EstimatedCost>;
  execute(request: TRequest, context: ProviderOperationContext): Promise<TResult>;
}

export interface RankingRequest {
  keyword: string;
  countryCode: string;
  languageCode: string;
  device: "desktop" | "mobile";
  depth: number;
}

export interface RankingResult {
  observedAt: Date;
  results: ReadonlyArray<{ position: number; url: string; title?: string }>;
}

export type RankingProvider = MonitoringProvider<RankingRequest, RankingResult>;

export interface EngagementRequest { contentId: string; publisherAccountId: string }
export interface EngagementResult { observedAt: Date; metrics: Readonly<Record<string, number>> }
export type EngagementProvider = MonitoringProvider<EngagementRequest, EngagementResult>;

export interface RevenueRequest { contentId: string; publisherAccountId: string; periodStart: Date; periodEnd: Date }
export interface RevenueResult { observedAt: Date; amountMinor: bigint; currency: string; sourceRecordId?: string }
export type RevenueProvider = MonitoringProvider<RevenueRequest, RevenueResult>;
