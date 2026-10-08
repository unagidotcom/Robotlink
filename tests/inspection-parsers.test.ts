import { describe, expect, it } from "vitest";
import { evaluateRobots, parseHtmlMetadata, parseXRobotsTag } from "@/lib/inspection/parsers";

describe("inspection parsers", () => {
  it("extracts canonical, title, description, and robots signals", () => {
    const result = parseHtmlMetadata(`<html><head><title> Example &amp; Test </title><meta name="description" content="A page"><meta name="robots" content="noindex, follow"><link rel="canonical" href="https://example.com/canonical"></head></html>`);
    expect(result).toEqual({ title: "Example & Test", description: "A page", canonicalUrl: "https://example.com/canonical", robots: ["noindex", "follow"] });
    expect(parseXRobotsTag(["noindex, nofollow"])).toEqual(["noindex", "nofollow"]);
  });
  it("uses the longest matching robots rule with allow winning ties", () => {
    const text = "User-agent: *\nDisallow: /private\nAllow: /private/public";
    expect(evaluateRobots(text, "/private/no", "RobotlinkTechnicalInspector").allowed).toBe(false);
    expect(evaluateRobots(text, "/private/public/a", "RobotlinkTechnicalInspector").allowed).toBe(true);
  });
});
