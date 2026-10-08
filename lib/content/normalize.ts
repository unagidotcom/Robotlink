import { createHash } from "node:crypto";
import { getPlatformAdapter, identifyPlatform } from "@/platforms/registry";

export const NORMALIZATION_VERSION = 1;

export interface NormalizedContentUrl {
  originalUrl: string;
  normalizedUrl: string;
  dedupeHash: string;
  platform: ReturnType<typeof identifyPlatform>["platform"];
  contentType: ReturnType<typeof identifyPlatform>["contentType"];
}

export function normalizeContentUrl(input: string): NormalizedContentUrl {
  const originalUrl = input.trim();
  if (originalUrl.length > 4096) throw new Error("URL exceeds 4096 characters");
  const match = identifyPlatform(originalUrl);
  const source = new URL(originalUrl);
  const adapter = getPlatformAdapter(match.platform);
  const normalized = adapter.normalize(source);

  if (match.platform === "INSTAGRAM") {
    const segments = normalized.pathname.split("/").filter(Boolean);
    const kind = segments[0]?.toLowerCase() === "reels" ? "reel" : segments[0]?.toLowerCase();
    const shortcode = segments[1];
    if (!shortcode || (kind !== "p" && kind !== "reel")) throw new Error("Unsupported Instagram content URL");
    normalized.protocol = "https:";
    normalized.hostname = "www.instagram.com";
    normalized.username = "";
    normalized.password = "";
    normalized.port = "";
    normalized.pathname = `/${kind}/${shortcode}/`;
    normalized.search = "";
  }

  const normalizedUrl = normalized.toString();
  return {
    originalUrl,
    normalizedUrl,
    dedupeHash: createHash("sha256").update(normalizedUrl).digest("hex"),
    platform: match.platform,
    contentType: match.contentType,
  };
}

export function normalizeKeyword(input: string): string {
  return input.trim().replace(/\s+/g, " ").toLocaleLowerCase("en-US");
}
