import { describe, expect, it } from "vitest";
import { isPublicAddress, validateInspectionUrl } from "@/lib/inspection/network-safety";

describe("inspection network safety", () => {
  it.each(["127.0.0.1", "10.0.0.1", "169.254.169.254", "192.168.1.1", "::1", "fc00::1", "fe80::1", "2001:db8::1", "::ffff:127.0.0.1"])("blocks non-public address %s", (address) => {
    expect(isPublicAddress(address)).toBe(false);
  });
  it.each(["8.8.8.8", "1.1.1.1", "2606:4700:4700::1111"])("allows public address %s", (address) => expect(isPublicAddress(address)).toBe(true));
  it("rejects credentials, unsafe ports, schemes, and local targets", () => {
    expect(() => validateInspectionUrl("file:///etc/passwd")).toThrow();
    expect(() => validateInspectionUrl("http://user:pass@example.com")).toThrow();
    expect(() => validateInspectionUrl("http://example.com:3000")).toThrow();
    expect(() => validateInspectionUrl("http://localhost/test")).toThrow();
  });
});
