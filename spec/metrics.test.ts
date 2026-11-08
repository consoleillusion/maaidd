import { describe, it, expect } from "bun:test";
import { runFta } from "../src/metrics/fta.ts";
import { checkGate } from "../src/metrics/gate.ts";
import { metricsToToon } from "../src/metrics/toon.ts";
import { encode, decode } from "@toon-format/toon";

describe("FTA metrics", () => {
  it("runs fta on examples/", () => {
    const result = runFta("examples");
    expect(result.total).toBeGreaterThan(0);
    expect(result.metrics[0]).toHaveProperty("file_name");
    expect(result.metrics[0]).toHaveProperty("cyclo");
    expect(result.metrics[0]).toHaveProperty("fta_score");
  });

  it("normalizes metric fields", () => {
    const result = runFta("examples");
    const m = result.metrics[0];
    expect(typeof m.file_name).toBe("string");
    expect(typeof m.cyclo).toBe("number");
    expect(typeof m.fta_score).toBe("number");
  });
});

describe("gate", () => {
  it("passes with lenient thresholds", () => {
    const result = runFta("examples");
    const violations = checkGate(result, {
      maxCyclomatic: 1000,
      minFtaScore: 0,
    });
    expect(violations).toHaveLength(0);
  });

  it("fails with strict thresholds", () => {
    const result = runFta("examples");
    const violations = checkGate(result, {
      maxCyclomatic: 0,
      minFtaScore: 100,
    });
    expect(violations.length).toBeGreaterThan(0);
  });
});

describe("TOON output", () => {
  it("produces valid TOON from metrics", () => {
    const result = runFta("examples");
    const toon = metricsToToon(result);
    expect(toon).toContain("files");
    expect(toon).toContain("average");
    // TOON should be decodable
    const decoded = decode(toon);
    expect(decoded).toHaveProperty("files");
  });
});