import { describe, expect, it } from "vitest";
import { hasPermission, requireAgencyMembership } from "@/lib/auth/authorization";
import { tenantWhere } from "@/lib/tenant/context";

describe("authorization", () => {
  it("keeps viewers read-only", () => {
    expect(hasPermission("VIEWER", "content:read")).toBe(true);
    expect(hasPermission("VIEWER", "content:write")).toBe(false);
  });

  it("does not expose cross-agency resources", () => {
    expect(() => requireAgencyMembership({ agencyId: "agency-b" }, "agency-a")).toThrow("NOT_FOUND");
  });

  it("always applies the authenticated agency last", () => {
    const context = { agencyId: "trusted", userId: "user", role: "OWNER" as const };
    expect(tenantWhere(context, { agencyId: "untrusted", active: true })).toEqual({ agencyId: "trusted", active: true });
  });
});
