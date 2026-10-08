import type { PlatformAdapter, PlatformMatch } from "./types";
import { normalizedWebUrl } from "./types";

const baseCapabilities = new Map() as PlatformAdapter["declaredCapabilities"];

function adapter(
  code: PlatformAdapter["code"],
  displayName: string,
  identify: PlatformAdapter["identify"],
  limitations: readonly string[] = [],
): PlatformAdapter {
  return { code, displayName, identify, limitations, declaredCapabilities: baseCapabilities, normalize: normalizedWebUrl };
}

export const platformAdapters: readonly PlatformAdapter[] = [
  adapter("INSTAGRAM", "Instagram", (url) => {
    if (!/(^|\.)instagram\.com$/i.test(url.hostname)) return null;
    if (/^\/reels?\/[^/]+/i.test(url.pathname)) return { platform: "INSTAGRAM", contentType: "REEL", confidence: "exact" };
    if (/^\/p\/[^/]+/i.test(url.pathname)) return { platform: "INSTAGRAM", contentType: "POST", confidence: "exact" };
    return null;
  }, [
    "Public visibility does not establish Google indexability.",
    "Professional-account eligibility and permissions require separate verification.",
    "Engagement, referrals, search visibility, and monetization are separate evidence streams.",
  ]),
  adapter("MEDIUM", "Medium", (url) => {
    const mediumHost = url.hostname === "medium.com" || url.hostname.endsWith(".medium.com");
    return mediumHost && url.pathname !== "/" ? { platform: "MEDIUM", contentType: "ARTICLE", confidence: "heuristic" } : null;
  }),
  adapter("WORDPRESS_COM", "WordPress.com", (url) =>
    url.hostname.endsWith(".wordpress.com") && url.pathname !== "/"
      ? { platform: "WORDPRESS_COM", contentType: "ARTICLE", confidence: "heuristic" }
      : null),
  adapter("BLOGGER", "Blogger", (url) =>
    (url.hostname.endsWith(".blogspot.com") || url.hostname.endsWith(".blogspot.in")) && url.pathname !== "/"
      ? { platform: "BLOGGER", contentType: "ARTICLE", confidence: "heuristic" }
      : null),
  adapter("SUBSTACK", "Substack", (url) =>
    url.hostname.endsWith(".substack.com") && /^\/p\//i.test(url.pathname)
      ? { platform: "SUBSTACK", contentType: "ARTICLE", confidence: "exact" }
      : null),
  adapter("LINKEDIN", "LinkedIn", (url) => {
    if (!/(^|\.)linkedin\.com$/i.test(url.hostname)) return null;
    if (/^\/pulse\//i.test(url.pathname)) return { platform: "LINKEDIN", contentType: "ARTICLE", confidence: "exact" };
    if (/^\/(?:feed\/update|posts)\//i.test(url.pathname)) return { platform: "LINKEDIN", contentType: "POST", confidence: "heuristic" };
    return null;
  }),
  adapter("PUBLIC_PDF", "Public PDF", (url) =>
    /\.pdf$/i.test(url.pathname) ? { platform: "PUBLIC_PDF", contentType: "PDF", confidence: "heuristic" } : null,
  ),
];

export const genericAdapter: PlatformAdapter = adapter(
  "GENERIC",
  "Generic third-party URL",
  () => ({ platform: "GENERIC", contentType: "OTHER", confidence: "fallback" }),
  ["Capabilities and account permissions are unknown until verified."],
);

export function identifyPlatform(input: string): PlatformMatch {
  const url = new URL(input);
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("Only HTTP and HTTPS URLs are supported");
  for (const candidate of platformAdapters) {
    const match = candidate.identify(url);
    if (match) return match;
  }
  return genericAdapter.identify(url) as PlatformMatch;
}

export function getPlatformAdapter(code: PlatformAdapter["code"]): PlatformAdapter {
  if (code === "GENERIC") return genericAdapter;
  const found = platformAdapters.find((candidate) => candidate.code === code);
  if (!found) throw new Error(`No platform adapter registered for ${code}`);
  return found;
}
