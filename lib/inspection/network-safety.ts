import dns from "node:dns/promises";
import net from "node:net";

export class InspectionNetworkError extends Error {
  constructor(public readonly category: string, message: string, public readonly retryable = false) { super(message); }
}

function ipv4Number(ip: string): number {
  return ip.split(".").reduce((value, part) => (value * 256 + Number(part)) >>> 0, 0);
}

function inV4Range(ip: string, base: string, bits: number): boolean {
  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
  return (ipv4Number(ip) & mask) === (ipv4Number(base) & mask);
}

export function isPublicAddress(address: string): boolean {
  const version = net.isIP(address);
  if (version === 4) {
    return ![["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8], ["169.254.0.0", 16],
      ["172.16.0.0", 12], ["192.0.0.0", 24], ["192.0.2.0", 24], ["192.168.0.0", 16], ["198.18.0.0", 15],
      ["198.51.100.0", 24], ["203.0.113.0", 24], ["224.0.0.0", 4], ["240.0.0.0", 4]].some(([base, bits]) => inV4Range(address, base as string, bits as number));
  }
  if (version === 6) {
    const value = address.toLowerCase();
    if (value.startsWith("::ffff:")) return isPublicAddress(value.slice(7));
    return value !== "::" && value !== "::1" && !value.startsWith("fc") && !value.startsWith("fd") &&
      !/^fe[89ab]/.test(value) && !value.startsWith("ff") && !value.startsWith("2001:db8:");
  }
  return false;
}

export function validateInspectionUrl(input: string | URL): URL {
  const url = input instanceof URL ? new URL(input) : new URL(input);
  if (!['http:', 'https:'].includes(url.protocol)) throw new InspectionNetworkError("UNSUPPORTED_SCHEME", "Only HTTP and HTTPS are supported");
  if (url.username || url.password) throw new InspectionNetworkError("URL_CREDENTIALS", "Credentials in URLs are not allowed");
  if (url.port && !['80', '443'].includes(url.port)) throw new InspectionNetworkError("UNSAFE_PORT", "Only standard HTTP ports are allowed");
  if (url.hostname === "localhost" || url.hostname.endsWith(".localhost")) throw new InspectionNetworkError("BLOCKED_HOST", "Local hosts are not allowed");
  if (net.isIP(url.hostname) && !isPublicAddress(url.hostname)) throw new InspectionNetworkError("BLOCKED_ADDRESS", "The destination address is not public");
  return url;
}

export type SafeAddress = { address: string; family: 4 | 6 };
export async function resolvePublicAddresses(hostname: string): Promise<SafeAddress[]> {
  const records = await dns.lookup(hostname, { all: true, verbatim: true });
  if (!records.length) throw new InspectionNetworkError("DNS_EMPTY", "The destination did not resolve", true);
  if (records.some((entry) => !isPublicAddress(entry.address))) throw new InspectionNetworkError("BLOCKED_ADDRESS", "The destination resolved to a non-public address");
  return records.map((entry) => ({ address: entry.address, family: entry.family as 4 | 6 }));
}
