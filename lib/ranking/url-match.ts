import { normalizeContentUrl } from "@/lib/content/normalize";

const ignored = [/^utm_/i, /^fbclid$/i, /^gclid$/i, /^igshid$/i, /^mc_(?:cid|eid)$/i];
function normalized(input: string): string {
  const url = new URL(input); url.protocol = "https:"; url.hash = ""; url.hostname = url.hostname.toLowerCase().replace(/^www\./, "");
  for (const key of [...url.searchParams.keys()]) if (ignored.some((rule) => rule.test(key))) url.searchParams.delete(key);
  url.searchParams.sort(); url.pathname = url.pathname.replace(/\/+$/, "") || "/";
  if (url.hostname === "instagram.com") {
    const match = /^\/(p|reels?)\/([^/]+)/i.exec(url.pathname); if (match) url.pathname = `/${match[1]!.toLowerCase() === "reels" ? "reel" : match[1]!.toLowerCase()}/${match[2]}`;
  }
  return url.toString();
}
export type UrlMatch = "EXACT" | "VERIFIED_EQUIVALENT" | "POSSIBLE" | "NO_MATCH";
export function matchRankingUrl(target: string, candidate: string, verifiedEquivalents: readonly string[] = []): UrlMatch {
  try {
    const rawTarget = new URL(target); const rawCandidate = new URL(candidate);
    if (rawTarget.toString() === rawCandidate.toString()) return "EXACT";
    const a = normalized(target); const b = normalized(candidate); if (a === b) return "VERIFIED_EQUIVALENT";
    if (verifiedEquivalents.some((value) => normalized(value) === b)) return "VERIFIED_EQUIVALENT";
    const platformA = normalizeContentUrl(target); const platformB = normalizeContentUrl(candidate);
    if (platformA.platform === platformB.platform && new URL(a).hostname === new URL(b).hostname && new URL(a).pathname === new URL(b).pathname) return "POSSIBLE";
    return "NO_MATCH";
  } catch { return "NO_MATCH"; }
}
