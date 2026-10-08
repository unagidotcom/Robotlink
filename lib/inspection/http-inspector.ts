import http from "node:http";
import https from "node:https";
import type { LookupFunction } from "node:net";
import { InspectionNetworkError, resolvePublicAddresses, validateInspectionUrl, type SafeAddress } from "./network-safety";
import { evaluateRobots, parseHtmlMetadata, parseXRobotsTag } from "./parsers";
import type { InspectionConfig } from "./config";

export type RedirectObservation = { sequence: number; fromUrl: string; toUrl: string; httpStatus: number };
export type InspectionResult = {
  requestedUrl: string; finalUrl?: string; outcome: "ACCESSIBLE" | "RESTRICTED" | "AUTH_REQUIRED" | "TEMPORARILY_UNAVAILABLE" | "PERMANENTLY_UNAVAILABLE" | "ERROR" | "UNKNOWN";
  derivedTechnicalStatus: "ACCESSIBLE" | "REDIRECTED" | "BLOCKED" | "NOINDEX_SIGNAL" | "CANONICALIZED_ELSEWHERE" | "UNREACHABLE" | "ERROR" | "UNKNOWN";
  httpStatus?: number; contentType?: string; contentLength?: number; title?: string; metaDescription?: string; canonicalUrl?: string;
  metaRobots: string[]; xRobotsTag: string[]; robotsAllowed?: boolean; robotsRule?: string; redirects: RedirectObservation[];
  errorCategory?: string; errorMessage?: string; rawObservations: Record<string, unknown>;
};

type ResponseData = { status: number; headers: http.IncomingHttpHeaders; body: Buffer; url: URL };
export type AddressResolver = (hostname: string) => Promise<SafeAddress[]>;
export type PinnedRequester = (url: URL, address: SafeAddress, config: InspectionConfig) => Promise<ResponseData>;

export const requestPinned: PinnedRequester = (url, address, config) => new Promise((resolve, reject) => {
  const client = url.protocol === "https:" ? https : http;
  const lookup: LookupFunction = (_hostname, _options, callback) => callback(null, address.address, address.family);
  const controller = new AbortController(); const totalTimer = setTimeout(() => controller.abort(), config.INSPECTION_TOTAL_TIMEOUT_MS);
  const request = client.request(url, {
    method: "GET", lookup, signal: controller.signal, servername: url.hostname,
    headers: { "user-agent": config.INSPECTION_USER_AGENT, accept: "text/html,application/pdf,text/plain;q=0.5", "accept-encoding": "identity" },
  }, (response) => {
    const chunks: Buffer[] = []; let length = 0;
    response.on("data", (chunk: Buffer) => {
      length += chunk.length;
      if (length > config.INSPECTION_MAX_BYTES) request.destroy(new InspectionNetworkError("RESPONSE_TOO_LARGE", "Response exceeded the configured size limit"));
      else chunks.push(chunk);
    });
    response.on("end", () => { clearTimeout(totalTimer); resolve({ status: response.statusCode ?? 0, headers: response.headers, body: Buffer.concat(chunks), url }); });
  });
  request.setTimeout(config.INSPECTION_CONNECT_TIMEOUT_MS, () => request.destroy(new InspectionNetworkError("CONNECTION_TIMEOUT", "Connection timed out", true)));
  request.on("error", (error) => { clearTimeout(totalTimer); reject(error.name === "AbortError" ? new InspectionNetworkError("TOTAL_TIMEOUT", "Inspection timed out", true) : error); });
  request.end();
});

async function safeRequest(url: URL, config: InspectionConfig, resolver: AddressResolver, requester: PinnedRequester) {
  validateInspectionUrl(url); const addresses = await resolver(url.hostname);
  // The vetted address is supplied to the socket lookup callback, so the connection cannot silently re-resolve the host.
  return requester(url, addresses[0]!, config);
}

async function follow(url: URL, config: InspectionConfig, resolver: AddressResolver, requester: PinnedRequester) {
  const redirects: RedirectObservation[] = []; let current = url;
  for (let index = 0; index <= config.INSPECTION_MAX_REDIRECTS; index += 1) {
    const response = await safeRequest(current, config, resolver, requester);
    if (![301, 302, 303, 307, 308].includes(response.status)) return { response, redirects };
    const location = response.headers.location;
    if (!location) return { response, redirects };
    if (index === config.INSPECTION_MAX_REDIRECTS) throw new InspectionNetworkError("REDIRECT_LIMIT", "Redirect limit exceeded");
    const next = validateInspectionUrl(new URL(location, current));
    redirects.push({ sequence: index + 1, fromUrl: current.toString(), toUrl: next.toString(), httpStatus: response.status });
    current = next;
  }
  throw new InspectionNetworkError("REDIRECT_LIMIT", "Redirect limit exceeded");
}

function classification(status: number) {
  if (status >= 200 && status < 400) return { outcome: "ACCESSIBLE" as const, technical: "ACCESSIBLE" as const };
  if (status === 401) return { outcome: "AUTH_REQUIRED" as const, technical: "BLOCKED" as const };
  if (status === 403 || status === 451) return { outcome: "RESTRICTED" as const, technical: "BLOCKED" as const };
  if (status === 404 || status === 410) return { outcome: "PERMANENTLY_UNAVAILABLE" as const, technical: "UNREACHABLE" as const };
  if (status === 408 || status === 425 || status === 429 || status >= 500) return { outcome: "TEMPORARILY_UNAVAILABLE" as const, technical: "ERROR" as const };
  return { outcome: "UNKNOWN" as const, technical: "UNKNOWN" as const };
}

export async function inspectUrl(input: string, config: InspectionConfig, dependencies: { resolver?: AddressResolver; requester?: PinnedRequester } = {}): Promise<InspectionResult> {
  const resolver = dependencies.resolver ?? resolvePublicAddresses; const requester = dependencies.requester ?? requestPinned;
  const requested = validateInspectionUrl(input); const empty = { requestedUrl: requested.toString(), metaRobots: [], xRobotsTag: [], redirects: [], rawObservations: {} };
  try {
    let robotsAllowed: boolean | undefined; let robotsRule: string | undefined;
    try {
      const robotsUrl = new URL("/robots.txt", requested.origin); const robotsResponse = await safeRequest(robotsUrl, config, resolver, requester);
      if (robotsResponse.status === 200 && /^text\//i.test(String(robotsResponse.headers["content-type"] ?? ""))) {
        const decision = evaluateRobots(robotsResponse.body.toString("utf8"), `${requested.pathname}${requested.search}`, config.INSPECTION_USER_AGENT);
        robotsAllowed = decision.allowed; robotsRule = decision.rule;
        if (!decision.allowed) return { ...empty, outcome: "RESTRICTED", derivedTechnicalStatus: "BLOCKED", robotsAllowed, robotsRule, rawObservations: { robotsStatus: 200 } };
      }
    } catch { /* robots uncertainty must not be fabricated as a prohibition */ }
    const { response, redirects } = await follow(requested, config, resolver, requester);
    const contentType = String(response.headers["content-type"] ?? "").split(";")[0]!.toLowerCase();
    const xHeader = response.headers["x-robots-tag"]; const xRobotsTag = parseXRobotsTag(Array.isArray(xHeader) ? xHeader : xHeader ? [xHeader] : []);
    const isHtml = contentType === "text/html" || contentType === "application/xhtml+xml"; const isPdf = contentType === "application/pdf" || requested.pathname.toLowerCase().endsWith(".pdf");
    if (!isHtml && !isPdf && response.status >= 200 && response.status < 300) throw new InspectionNetworkError("UNSUPPORTED_CONTENT_TYPE", "Response is neither HTML nor PDF");
    const metadata = isHtml ? parseHtmlMetadata(response.body.toString("utf8")) : { title: undefined, description: undefined, canonicalUrl: undefined, robots: [] };
    const combined = [...new Set([...metadata.robots, ...xRobotsTag])]; const noindex = combined.includes("noindex") || combined.includes("none");
    const canonical = metadata.canonicalUrl ? new URL(metadata.canonicalUrl, response.url).toString() : undefined;
    const base = classification(response.status); let technical: InspectionResult["derivedTechnicalStatus"] = redirects.length ? "REDIRECTED" : base.technical;
    if (noindex) technical = "NOINDEX_SIGNAL"; else if (canonical && canonical !== response.url.toString()) technical = "CANONICALIZED_ELSEWHERE";
    return { ...empty, finalUrl: response.url.toString(), outcome: base.outcome, derivedTechnicalStatus: technical, httpStatus: response.status,
      contentType, contentLength: response.body.length, title: metadata.title, metaDescription: metadata.description, canonicalUrl: canonical,
      metaRobots: metadata.robots, xRobotsTag, robotsAllowed, robotsRule, redirects,
      rawObservations: { robotsChecked: robotsAllowed !== undefined, redirectCount: redirects.length, pdfHeadersOnly: isPdf } };
  } catch (error) {
    const known = error instanceof InspectionNetworkError; return { ...empty, outcome: "ERROR", derivedTechnicalStatus: "ERROR",
      errorCategory: known ? error.category : "NETWORK_ERROR", errorMessage: known ? error.message : "The inspection failed safely", rawObservations: {} };
  }
}
