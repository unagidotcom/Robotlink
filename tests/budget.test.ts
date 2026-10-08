import { describe, expect, it } from "vitest";
import { evaluateBudget } from "@/providers/budget";

const snapshot = { hardLimitMinor: 1_000n, spentMinor: 400n, reservedMinor: 100n, currency: "USD", operationsUsed: 3, maxOperations: 5 };

describe("monitoring budget boundary", () => {
  it("reserves work only inside both limits", () => {
    expect(evaluateBudget(snapshot, { amountMinor: 200n, currency: "USD", units: 1 })).toEqual({ allowed: true, remainingMinor: 300n });
  });

  it("rejects cost, operation, and currency overruns", () => {
    expect(evaluateBudget(snapshot, { amountMinor: 501n, currency: "USD", units: 1 })).toEqual({ allowed: false, reason: "hard_limit" });
    expect(evaluateBudget(snapshot, { amountMinor: 1n, currency: "USD", units: 3 })).toEqual({ allowed: false, reason: "operation_limit" });
    expect(evaluateBudget(snapshot, { amountMinor: 1n, currency: "EUR", units: 1 })).toEqual({ allowed: false, reason: "currency_mismatch" });
  });
});
