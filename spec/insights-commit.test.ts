import { describe, expect, it } from "bun:test";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getCommitGuide } from "../src/insights/commit.ts";
import { savePendingSnapshot, saveSnapshot } from "../src/metrics/store.ts";
import type { FtaFileMetric } from "../src/metrics/fta.ts";
import type { TestRunSummary } from "../src/metrics/test-runner.ts";
import { runCli } from "./test-utils.ts";

const metric: FtaFileMetric = {
  file_name: "src/a.ts",
  cyclo: 4,
  fta_score: 80,
  assessment: "OK",
  line_count: 100,
  halstead: { bugs: 0.05 },
};

const tests: TestRunSummary = {
  command: "bun test",
  total: 2,
  passed: 2,
  failed: 0,
  skipped: 0,
  todo: 0,
  exitCode: 0,
};

const git = (dir: string, args: string[]): string =>
  execFileSync("git", args, { cwd: dir, encoding: "utf8" }).trim();

const setup = (config: object = {}) => {
  const dir = mkdtempSync(join(tmpdir(), "maid-commit-"));
  writeFileSync(
    join(dir, "maid.config.json"),
    `${JSON.stringify(config)}\n`,
    "utf8",
  );
  writeFileSync(
    join(dir, "package.json"),
    `${JSON.stringify({ name: "fixture", dependencies: { left: "^1.0.0" } })}\n`,
  );
  git(dir, ["init", "-q"]);
  git(dir, ["config", "user.email", "test@example.com"]);
  git(dir, ["config", "user.name", "Test"]);
  git(dir, ["add", "-A"]);
  git(dir, ["commit", "-q", "-m", "baseline"]);
  const baseline = git(dir, ["rev-parse", "HEAD"]);
  saveSnapshot(dir, baseline, [metric], tests);
  return dir;
};

describe("commit guidance", () => {
  it("reports readiness and a dependency-only commit suggestion", () => {
    const dir = setup();
    try {
      writeFileSync(
        join(dir, "package.json"),
        `${JSON.stringify({ name: "fixture", dependencies: { left: "^1.0.0", right: "^2.0.0" } })}\n`,
      );
      savePendingSnapshot(dir, [metric], tests);
      const payload = getCommitGuide({ root: dir });
      expect(payload.kind).toBe("commit");
      expect(payload.ready).toBe(true);
      expect(payload.blockers).toEqual([]);
      expect(payload.checks.pending.passed).toBe(true);
      expect(payload.checks.tests.passed).toBe(true);
      expect(payload.checks.gate.passed).toBe(true);
      expect(payload.suggestedMessage).toBe("chore(deps): update dependencies");
      expect(payload.dependencies.files).toEqual(["package.json"]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("blocks when the pending snapshot is missing", () => {
    const dir = setup();
    try {
      writeFileSync(join(dir, "src.ts"), "export const a = 1;\n");
      const payload = getCommitGuide({ root: dir });
      expect(payload.ready).toBe(false);
      expect(payload.blockers).toContain("pending");
      expect(payload.next.join(" ")).toContain("metrics --pending");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("warns about oversized commits and suggests documentation messages", () => {
    const dir = setup({
      insights: { commit: { maxChangedFiles: 0, maxChangedLines: 0 } },
    });
    try {
      writeFileSync(join(dir, "docs.md"), "# Docs\n");
      savePendingSnapshot(dir, [metric], tests);
      const payload = getCommitGuide({ root: dir });
      expect(payload.checks.size.passed).toBe(false);
      expect(payload.warnings).toContain("size");
      expect(payload.ready).toBe(false);
      expect(payload.suggestedMessage).toBe("docs: update documentation");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("prints the same payload from the CLI", () => {
    const dir = setup();
    try {
      writeFileSync(join(dir, "docs.md"), "# Docs\n");
      savePendingSnapshot(dir, [metric], tests);
      const result = runCli(["commit-guide"], { cwd: dir });
      expect(result.status).toBe(0);
      const payload = JSON.parse(result.stdout);
      expect(payload.kind).toBe("commit");
      expect(payload.suggestedMessage).toBe("docs: update documentation");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
