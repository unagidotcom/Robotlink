import { describe, expect, it } from "vitest";
import { classifyDiscoveryEligibility } from "@/lib/discovery/classification";
import { prepareEditorialReference, verifyEditorialFingerprint } from "@/lib/discovery/editorial";

describe("discovery eligibility", () => {
  it("waits for technical evidence", () => {
    expect(classifyDiscoveryEligibility({ technicalStatus: "UNKNOWN", publisherAuthorized: false, editable: false })).toMatchObject({ eligibility: "UNKNOWN", workflowStatus: "AWAITING_INSPECTION" });
  });

  it("rejects restricted technical signals", () => {
    expect(classifyDiscoveryEligibility({ technicalStatus: "NOINDEX_SIGNAL", inspectionOutcome: "ACCESSIBLE", publisherAuthorized: false, editable: false })).toMatchObject({ eligibility: "UNSUPPORTED_OR_RESTRICTED" });
  });

  it("requires both authorization and editing permission for owned classification", () => {
    expect(classifyDiscoveryEligibility({ technicalStatus: "ACCESSIBLE", inspectionOutcome: "ACCESSIBLE", publisherAuthorized: true, editable: true })).toMatchObject({ eligibility: "OWNED_AUTHORIZED_URL", workflowStatus: "ELIGIBLE_FOR_EDITORIAL_REVIEW" });
    expect(classifyDiscoveryEligibility({ technicalStatus: "ACCESSIBLE", inspectionOutcome: "ACCESSIBLE", publisherAuthorized: true, editable: false })).toMatchObject({ eligibility: "THIRD_PARTY_URL" });
  });
});

describe("source-backed editorial drafts", () => {
  it("uses attributed verified fields and detects later changes", () => {
    const draft = prepareEditorialReference({ url: "https://publisher.example/article", title: " Verified source title ", description: "Source description.", inspectedAt: new Date("2026-10-12T00:00:00.000Z") });
    expect(draft.draftReference).toContain("Verified source title");
    expect(draft.draftReference).toContain("publisher.example");
    expect(verifyEditorialFingerprint(draft)).toBe(true);
    expect(verifyEditorialFingerprint({ ...draft, draftReference: `${draft.draftReference} Unsupported claim.` })).toBe(false);
  });

  it("refuses a draft without a verified title", () => {
    expect(() => prepareEditorialReference({ url: "https://publisher.example/article", title: "  ", inspectedAt: new Date() })).toThrow("VERIFIED_SOURCE_TITLE_REQUIRED");
  });
});
