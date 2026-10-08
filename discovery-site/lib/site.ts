export const siteName = "Atlas & Footpath";
export const siteDescription =
  "Independent, carefully edited field notes for slower journeys and thoughtful travel.";

export function validateSiteUrl(value: string, requirePublicOrigin = false): URL {
  const url = new URL(value);
  const isLocal = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  const isPlaceholder = url.hostname.endsWith(".example") || url.hostname.endsWith(".test");

  if (requirePublicOrigin && (url.protocol !== "https:" || isLocal || isPlaceholder)) {
    throw new Error(
      "NEXT_PUBLIC_SITE_URL must be the final public HTTPS origin for a Vercel deployment.",
    );
  }

  url.pathname = "/";
  url.search = "";
  url.hash = "";
  return url;
}

export function getSiteUrl(): URL {
  const configured = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3001";
  return validateSiteUrl(configured, process.env.VERCEL === "1");
}

export function absoluteUrl(pathname: string): string {
  return new URL(pathname, getSiteUrl()).toString();
}
