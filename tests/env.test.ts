import { describe, expect, it } from "vitest";
import { getEnv } from "@/lib/env";

describe("environment validation", () => {
  it("accepts a valid PostgreSQL configuration", () => {
    expect(getEnv({ DATABASE_URL: "postgresql://user:pass@localhost:5432/app", APP_ORIGIN: "https://seo.example.com" }).SESSION_TTL_HOURS).toBe(12);
  });

  it("rejects non-PostgreSQL databases and invalid origins", () => {
    expect(() => getEnv({ DATABASE_URL: "file:./dev.db", APP_ORIGIN: "not-a-url" })).toThrow(/Invalid environment/);
  });
});
