import { describe, expect, it } from "vitest";
import { getRankingConfig, locationCode } from "@/lib/ranking/config";
describe("ranking configuration", () => { it("defaults paid execution off", () => { const config = getRankingConfig({}); expect(config.DATAFORSEO_EXECUTION_ENABLED).toBe(false); expect(locationCode(config, "US")).toBe(2840); }); });
