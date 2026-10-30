export type DiscoveryClassification = {
  eligibility: "UNKNOWN" | "THIRD_PARTY_URL" | "OWNED_AUTHORIZED_URL" | "UNSUPPORTED_OR_RESTRICTED";
  workflowStatus: "AWAITING_INSPECTION" | "ELIGIBLE_FOR_EDITORIAL_REVIEW";
  reason: string;
};

type ClassificationInput = {
  technicalStatus: string;
  inspectionOutcome?: string | null;
  publisherAuthorized: boolean;
  editable: boolean;
};

const restrictedStatuses = new Set(["BLOCKED", "NOINDEX_SIGNAL", "CANONICALIZED_ELSEWHERE", "UNREACHABLE", "ERROR"]);
const restrictedOutcomes = new Set(["RESTRICTED", "AUTH_REQUIRED", "TEMPORARILY_UNAVAILABLE", "PERMANENTLY_UNAVAILABLE", "ERROR"]);

export function classifyDiscoveryEligibility(input: ClassificationInput): DiscoveryClassification {
  if (input.technicalStatus === "UNKNOWN" || input.technicalStatus === "PENDING" || !input.inspectionOutcome) {
    return { eligibility: "UNKNOWN", workflowStatus: "AWAITING_INSPECTION", reason: "A completed technical inspection is required before editorial eligibility can be classified." };
  }
  if (restrictedStatuses.has(input.technicalStatus) || restrictedOutcomes.has(input.inspectionOutcome)) {
    return { eligibility: "UNSUPPORTED_OR_RESTRICTED", workflowStatus: "AWAITING_INSPECTION", reason: "The latest technical evidence indicates that the URL is restricted or unsuitable for an editorial reference." };
  }
  if (input.publisherAuthorized && input.editable) {
    return { eligibility: "OWNED_AUTHORIZED_URL", workflowStatus: "ELIGIBLE_FOR_EDITORIAL_REVIEW", reason: "Verified account authorization and editing permission are recorded for this accessible URL." };
  }
  return { eligibility: "THIRD_PARTY_URL", workflowStatus: "ELIGIBLE_FOR_EDITORIAL_REVIEW", reason: "The URL is technically accessible, but Robotlink has no verified ownership or editing authorization." };
}
