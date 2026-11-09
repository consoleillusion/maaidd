import { describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { normalizeConfig } from "../src/config.ts";
import { getStatus } from "../src/insights/status.ts";
import { DEFAULT_CONFIG } from "../src/types.ts";
import { makeTempDir, runCli } from "./test-utils.ts";

describe("insights config", () => {
  it("merges partial insights overrides over defaults", () => {
    const config = normalizeConfig({
      insights: {
        benchmark: { baseline: "first" },
        score: { weights: { gate: 30, fta: 10 } },
        commit: { maxChangedFiles: 3 },
      },
    });
    expect(config.insights.benchmark.baseline).toBe("first");
    expect(config.insights.score.weights.gate).toBe(30);
    expect(config.insights.score.weights.fta).toBe(10);
    expect(config.insights.score.weights.tests).toBe(
      DEFAULT_CONFIG.insights.score.weights.tests,
    );
    expect(config.insights.commit.maxChangedFiles).toBe(3);
  });

  it("rejects invalid score weights and grades", () => {
    expect(() =>
      normalizeConfig({
        insights: {
          score: {
            weights: {
              gate: 0,
              fta: 0,
              complexity: 0,
              tests: 0,
              trend: 0,
              dependencies: 0,
            },
          },
        },
      }),
    ).toThrow(/weights/);
    expect(() =>
      normalizeConfig({
        insights: { score: { grades: { A: 60, B: 80, C: 70, D: 50 } } },
      }),
    ).toThrow(/grades/);
  });
});

describe("status insight", () => {
  it("reports project, snapshot, and git sections for an empty project", () => {
    const dir = mkdtempSync(join(tmpdir(), "maid-status-"));
    try {
      writeFileSync(join(dir, "maid.config.json"), "{}\n", "utf8");
      const payload = getStatus({ root: dir });
      expect(payload.kind).toBe("status");
      expect(payload.schemaVersion).toBe(1);
      expect((payload.project as any).status).toBe("missing");
      expect((payload.snapshot as any).current).toBeNull();
      expect((payload.git as any).isRepo).toBe(false);
      expect(payload.benchmark).toBeDefined();
      expect(payload.score).toBeDefined();
      expect(payload.dependencies).toBeDefined();
      expect(payload.commit).toBeDefined();
      expect((payload.next as string[]).length).toBeGreaterThan(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("prints the same kind of payload from the CLI", () => {
    const dir = makeTempDir("maid-status-cli-");
    try {
      writeFileSync(join(dir, "maid.config.json"), "{}\n", "utf8");
      const result = runCli(["status"], { cwd: dir });
      expect(result.status).toBe(0);
      const payload = JSON.parse(result.stdout);
      expect(payload.kind).toBe("status");
      expect(payload.project.status).toBe("missing");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
