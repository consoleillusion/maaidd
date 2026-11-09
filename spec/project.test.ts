import { afterEach, describe, expect, it } from "bun:test";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  buildSetupPlan,
  detectProject,
  PROJECT_DOC,
  PROJECT_FILE,
  readProjectContext,
  renderProjectMarkdown,
  updateProject,
} from "../src/project.ts";
import { makeTempDir } from "./test-utils.ts";

const temporaryDirs: string[] = [];

const makeProject = (): string => {
  const dir = makeTempDir("maaidd-project-");
  temporaryDirs.push(dir);
  writeFileSync(
    join(dir, "package.json"),
    `${JSON.stringify(
      {
        name: "demo-app",
        description: "A demo application",
        scripts: { test: "bun test", build: "bun run build" },
        devDependencies: { typescript: "^5", react: "^19" },
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
  writeFileSync(join(dir, "tsconfig.json"), "{}\n", "utf8");
  writeFileSync(join(dir, "bun.lock"), "", "utf8");
  return dir;
};

afterEach(() => {
  for (const dir of temporaryDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("project detection", () => {
  it("detects software from common manifests", () => {
    const dir = makeProject();
    const detected = detectProject(dir);

    expect(detected.name).toBe("demo-app");
    expect(detected.goal).toBe("A demo application");
    expect(detected.software.languages).toContain("TypeScript");
    expect(detected.software.runtime).toBe("bun");
    expect(detected.software.packageManager).toBe("bun");
    expect(detected.software.frameworks).toContain("React");
    expect(detected.software.testCommand).toBe("bun test");
    expect(detected.software.buildCommand).toBe("bun run build");
    expect(detected.sources).toContain("package.json");
  });
});

describe("project setup plan", () => {
  it("returns required questions and defaults without optional settings", () => {
    const dir = makeProject();
    const plan = buildSetupPlan(dir, "required");

    expect(plan.status).toBe("missing");
    expect(plan.missing).toContain("goal");
    expect(plan.required.map((question) => question.key)).toEqual(
      expect.arrayContaining(["goal", "scope.in", "scope.out"]),
    );
    expect(plan.required.map((question) => question.key)).not.toContain(
      "software",
    );
    expect(plan.defaults?.bestPractices.commits).toContain("atomic");
    expect(plan.optional).toBeUndefined();
  });

  it("returns the optional catalog only when requested", () => {
    const dir = makeProject();
    const plan = buildSetupPlan(dir, "optional");

    expect(plan.optional?.map((option) => option.key)).toEqual(
      expect.arrayContaining([
        "design.principles",
        "constraints",
        "bestPractices.commits",
        "config.lineWidth",
        "config.metrics.thresholds.minFtaScore",
      ]),
    );
  });
});

describe("project persistence", () => {
  it("writes JSON and deterministic Markdown with defaults", () => {
    const dir = makeProject();
    const result = updateProject({
      root: dir,
      project: {
        goal: "Build a demo",
        scope: { in: ["core behavior"], out: ["billing"] },
      },
    });

    expect(result.status).toBe("complete");
    expect(result.written).toEqual(
      expect.arrayContaining([PROJECT_FILE, PROJECT_DOC]),
    );
    expect(existsSync(join(dir, PROJECT_FILE))).toBe(true);
    expect(existsSync(join(dir, PROJECT_DOC))).toBe(true);

    const saved = JSON.parse(
      readFileSync(join(dir, PROJECT_FILE), "utf8"),
    ) as Record<string, unknown>;
    expect(saved.goal).toBe("Build a demo");
    expect((saved.bestPractices as Record<string, string>).commits).toContain(
      "atomic",
    );

    const markdown = readFileSync(join(dir, PROJECT_DOC), "utf8");
    expect(markdown).toContain("# demo-app");
    expect(markdown).toContain("Build a demo");
    expect(markdown).toContain("**Style:** `biome`");
    expect(markdown).toBe(renderProjectMarkdown(result.project, result.config));
  });

  it("regenerates byte-identical Markdown and preserves updatedAt on no-op", () => {
    const dir = makeProject();
    const first = updateProject({
      root: dir,
      project: {
        goal: "Build a demo",
        scope: { in: ["core behavior"] },
      },
    });
    const firstMarkdown = readFileSync(join(dir, PROJECT_DOC), "utf8");

    const second = updateProject({
      root: dir,
      project: { goal: "Build a demo" },
    });

    expect(readFileSync(join(dir, PROJECT_DOC), "utf8")).toBe(firstMarkdown);
    expect(second.project.updatedAt).toBe(first.project.updatedAt);
  });

  it("merges optional tooling overrides into maaidd.config.json", () => {
    const dir = makeProject();
    const result = updateProject({
      root: dir,
      config: {
        lineWidth: 100,
        metrics: { thresholds: { minFtaScore: 70 } },
      },
    });

    const config = JSON.parse(
      readFileSync(join(dir, "maaidd.config.json"), "utf8"),
    ) as {
      lineWidth: number;
      metrics: { thresholds: { minFtaScore: number } };
    };
    expect(config.lineWidth).toBe(100);
    expect(config.metrics.thresholds.minFtaScore).toBe(70);
    expect(result.markdown).toContain("**Line width:** `100`");
    expect(result.markdown).toContain("**Min FTA score:** `70`");
  });

  it("detects drift and regenerates the generated document", () => {
    const dir = makeProject();
    updateProject({
      root: dir,
      project: {
        goal: "Build a demo",
        scope: { in: ["core behavior"] },
      },
    });
    writeFileSync(join(dir, PROJECT_DOC), "tampered\n", "utf8");

    expect(readProjectContext(dir).docInSync).toBe(false);

    updateProject({ root: dir });
    expect(readProjectContext(dir).docInSync).toBe(true);
  });

  it("supports dry runs without writing files", () => {
    const dir = makeProject();
    const result = updateProject({
      root: dir,
      project: {
        goal: "Build a demo",
        scope: { in: ["core behavior"] },
      },
      dryRun: true,
    });

    expect(result.dryRun).toBe(true);
    expect(result.written).toEqual([]);
    expect(existsSync(join(dir, PROJECT_FILE))).toBe(false);
    expect(existsSync(join(dir, PROJECT_DOC))).toBe(false);
    expect(result.markdown).toContain("Build a demo");
  });

  it("rejects invalid project input", () => {
    const dir = makeProject();
    expect(() =>
      updateProject({
        root: dir,
        project: { goal: 123 } as never,
      }),
    ).toThrow();
  });
});
