import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { hashSessionToken } from "@/lib/auth/session";
import { loginSchema } from "@/lib/validation/auth";

describe("password hashing", () => {
  it("round-trips a valid password without storing plaintext", async () => {
    const password = "correct horse battery staple";
    const stored = await hashPassword(password);
    expect(stored).not.toContain(password);
    await expect(verifyPassword(password, stored)).resolves.toBe(true);
    await expect(verifyPassword("incorrect password value", stored)).resolves.toBe(false);
  });

  it("rejects short passwords", async () => {
    await expect(hashPassword("short")).rejects.toThrow(/12/);
  });

  it("hashes session tokens deterministically without preserving the token", () => {
    const token = "a".repeat(43);
    const hash = hashSessionToken(token);
    expect(hash).toHaveLength(64);
    expect(hash).not.toContain(token);
    expect(hashSessionToken(token)).toBe(hash);
  });

  it("validates and normalizes login input", () => {
    expect(loginSchema.parse({ email: " OWNER@Example.COM ", password: "long-enough-password" }).email).toBe("owner@example.com");
    expect(() => loginSchema.parse({ email: "bad", password: "short" })).toThrow();
  });
});
