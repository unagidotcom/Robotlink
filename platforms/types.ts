import type { ContentType, PlatformCode } from "@prisma/client";

export type PlatformCapabilityCode =
  | "edit_title"
  | "edit_caption"
  | "edit_body"
  | "edit_headings"
  | "edit_slug"
  | "edit_metadata"
  | "set_canonical"
  | "edit_links"
  | "edit_tags"
  | "configure_public_visibility"
  | "read_engagement"
  | "read_referrals"
  | "read_revenue";

export interface PlatformMatch {
  platform: PlatformCode;
  contentType: ContentType;
  confidence: "exact" | "heuristic" | "fallback";
}

export interface PlatformAdapter {
  readonly code: PlatformCode;
  readonly displayName: string;
  identify(url: URL): PlatformMatch | null;
  normalize(url: URL): URL;
  readonly declaredCapabilities: ReadonlyMap<PlatformCapabilityCode, "supported" | "partial" | "unsupported" | "unknown">;
  readonly limitations: readonly string[];
}

export function normalizedWebUrl(input: URL): URL {
  const url = new URL(input);
  url.hash = "";
  url.hostname = url.hostname.toLowerCase();
  if ((url.protocol === "https:" && url.port === "443") || (url.protocol === "http:" && url.port === "80")) url.port = "";
  if (!url.pathname) url.pathname = "/";
  return url;
}
