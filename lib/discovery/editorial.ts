import { createHash } from "node:crypto";

export type VerifiedSource = {
  url: string;
  title: string;
  description?: string | null;
  publisher?: string | null;
  inspectedAt: Date;
};

function clean(value: string, maximum: number): string {
  return value.replace(/\s+/g, " ").trim().slice(0, maximum);
}

export function prepareEditorialReference(source: VerifiedSource) {
  const title = clean(source.title, 500);
  if (!title) throw new Error("VERIFIED_SOURCE_TITLE_REQUIRED");
  const description = source.description ? clean(source.description, 800) : null;
  const host = new URL(source.url).hostname.replace(/^www\./, "");
  const publisher = clean(source.publisher || host, 500);
  const attributionLabel = `${title} — ${publisher}`;
  const draftReference = description
    ? `Read “${title}” from ${publisher}. The source describes it as: “${description}”`
    : `Read “${title}” from ${publisher} for the original source and current details.`;
  const supportedClaims = { title, description, publisher, sourceUrl: source.url, inspectedAt: source.inspectedAt.toISOString() };
  const draftFingerprint = createHash("sha256").update(JSON.stringify({ draftReference, attributionLabel, supportedClaims })).digest("hex");
  return { sourceTitle: title, sourceDescription: description, sourcePublisher: publisher, draftReference, attributionLabel, supportedClaims, draftFingerprint };
}

export function verifyEditorialFingerprint(input: { draftReference: string; attributionLabel: string; supportedClaims: unknown; draftFingerprint: string }): boolean {
  const expected = createHash("sha256").update(JSON.stringify({ draftReference: input.draftReference, attributionLabel: input.attributionLabel, supportedClaims: input.supportedClaims })).digest("hex");
  return expected === input.draftFingerprint;
}
