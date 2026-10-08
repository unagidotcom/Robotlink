import type { EstimatedCost } from "./types";

export interface BudgetSnapshot {
  hardLimitMinor: bigint;
  spentMinor: bigint;
  reservedMinor: bigint;
  currency: string;
  operationsUsed: number;
  maxOperations?: number;
}

export type BudgetDecision =
  | { allowed: true; remainingMinor: bigint }
  | { allowed: false; reason: "currency_mismatch" | "hard_limit" | "operation_limit" };

export function evaluateBudget(snapshot: BudgetSnapshot, estimate: EstimatedCost): BudgetDecision {
  if (snapshot.currency !== estimate.currency) return { allowed: false, reason: "currency_mismatch" };
  if (snapshot.maxOperations !== undefined && snapshot.operationsUsed + estimate.units > snapshot.maxOperations) {
    return { allowed: false, reason: "operation_limit" };
  }
  const remainingMinor = snapshot.hardLimitMinor - snapshot.spentMinor - snapshot.reservedMinor - estimate.amountMinor;
  return remainingMinor < 0n ? { allowed: false, reason: "hard_limit" } : { allowed: true, remainingMinor };
}
