import { afterEach, describe, expect, it } from "bun:test";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { readHistory } from "../src/metrics/history.ts";
import { makeTempDir, ROOT, runCli, writeExecutable } from "./test-utils.ts";

const temporaryDirs: string[] = [];
function project(): { dir: string; source: string } {
  const dir = makeTempDir();
  temporaryDirs.push(dir);
  const source = join(dir, "source.ts");
  writeFileSync(
    source,
    `export function score(value: number): number {
  if (value > 10) {
    return value * 3;
  }
  if (value > 2) {
    return value * 2;
  }
  if (value < 0) {
    return 0;
  }
  return value + 1;
}
`,
  );
  return { dir, source };
}
afterEach(() => {
  for (const dir of temporaryDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function fakeTests(dir: string): string {
  const command = join(dir, "fake-tests");
  writeExecutable(
    command,
    "#!/bin/sh\nprintf ' 7 pass\\n 1 fail\\nRan 8 tests across 1 files. [0.10s]\\n'\nexit 1\n",
  );
  return command;
}

function currentHead(): string {
  return execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: ROOT,
    encoding: "utf8",
  }).trim();
}

describe("metrics and gate commands", () => {
  it("writes machine-readable FTA metrics", () => {
    const { dir } = project();
    const result = runCli(["metrics", dir, "--format", "json"], { cwd: dir });
    expect(result.status).toBe(0);
    const metrics = JSON.parse(result.stdout);
    expect(metrics).toHaveLength(1);
    expect(metrics[0].file_name).toContain("source.ts");
    expect(metrics[0].cyclo).toBeGreaterThan(0);
  });

  it("uses config thresholds for gate exit statuses and violations", () => {
    const { dir } = project();
    const lenient = join(dir, "lenient.json");
    const strict = join(dir, "strict.json");
    writeFileSync(
      lenient,
      JSON.stringify({
        metrics: { thresholds: { maxCyclomatic: 1000, minFtaScore: 0 } },
      }),
    );
    writeFileSync(
      strict,
      JSON.stringify({
        metrics: { thresholds: { maxCyclomatic: 0, minFtaScore: 100 } },
      }),
    );

    const passing = runCli(["gate", dir, "--config", lenient], { cwd: dir });
    expect(passing.status).toBe(0);
    expect(passing.stdout).toContain("Gate passed: 1 files checked");

    const failing = runCli(["gate", dir, "--config", strict], { cwd: dir });
    expect(failing.status).toBe(1);
    expect(failing.stderr).toContain("Gate failed:");
    expect(failing.stderr).toContain("cyclomatic complexity");
  });

  it("saves FTA metrics and real test counts under the current git HEAD (SQLite)", () => {
    const { dir } = project();
    const testCommand = fakeTests(dir);
    const result = runCli(
      ["metrics", dir, "--save", "--test-command", testCommand],
      { cwd: dir },
    );
    expect(result.status).toBe(0);
    expect(result.stderr).toContain("Tests: 7/8 passed, 1 failed");
    expect(existsSync(join(dir, "metric", "maaidd.db"))).toBe(true);

    const [snapshot] = readHistory(join(dir, "metric"));
    expect(snapshot.commit).toBe(currentHead());
    expect(snapshot.tests).toMatchObject({
      command: testCommand,
      total: 8,
      passed: 7,
      failed: 1,
      exitCode: 1,
    });
    expect(snapshot.metrics).toHaveLength(1);
  });

  it("creates a pending snapshot before commit and finalizes it afterward", () => {
    const { dir } = project();
    const testCommand = fakeTests(dir);
    const pending = runCli(
      ["metrics", dir, "--pending", "--test-command", testCommand],
      { cwd: dir },
    );
    expect(pending.status).toBe(0);
    expect(readHistory(join(dir, "metric"))).toHaveLength(0);
    expect(existsSync(join(dir, "metric", "maaidd.db"))).toBe(true);

    const finalized = runCli(["metrics", "--finalize"], { cwd: dir });
    expect(finalized.status).toBe(0);
    expect(readHistory(join(dir, "metric"))).toHaveLength(1);
    expect(readHistory(join(dir, "metric"))[0].commit).toBe(currentHead());
  });

  it("can omit test collection explicitly", () => {
    const { dir } = project();
    const pending = runCli(["metrics", dir, "--pending", "--no-tests"], {
      cwd: dir,
    });
    expect(pending.status).toBe(0);

    const finalized = runCli(["metrics", "--finalize"], { cwd: dir });
    expect(finalized.status).toBe(0);
    const [snapshot] = readHistory(join(dir, "metric"));
    expect(snapshot.tests).toBeNull();
    expect(snapshot.metrics).toHaveLength(1);
  });

  it("fails cleanly when trying to finalize without pending metrics", () => {
    const { dir } = project();
    mkdirSync(join(dir, "metric"), { recursive: true });
    const result = runCli(["metrics", "--finalize"], { cwd: dir });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("No pending metric snapshot");
  });
});
