/**
 * `maaidd init` — write maaidd.config.json + biome.json if missing.
 */
import { buildCommand } from "@stricli/core";
import { execFileSync } from "node:child_process";
import { chmodSync, existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const DEFAULT_MAAIDD_CONFIG = `{
  "style": "biome",
  "indent": 2,
  "lineWidth": 80,
  "semicolons": true,
  "quoteStyle": "double",
  "trailingComma": "all",
  "toArrow": false,
  "biome": true,
  "functional": {
    "commaStyle": "leading",
    "objectValueIndent": 1,
    "arrayValueIndent": 2,
    "forceBlankLines": true,
    "semicolons": true,
    "maxInlineArrayItems": 3
  },
  "metrics": {
    "excludeUnder": 0,
    "testCommand": "bun run test",
    "thresholds": {
      "maxCyclomatic": 20,
      "minFtaScore": 50
    }
  },
  "mcp": {
    "codegraph": true,
    "metrics": true
  }
}
`;

const DEFAULT_BIOME_CONFIG = `{
  "$schema": "https://biomejs.dev/schemas/2.6.6/schema.json",
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 80,
    "lineEnding": "lf"
  },
  "javascript": {
    "formatter": {
      "quoteStyle": "double",
      "jsxQuoteStyle": "double",
      "semicolons": "always",
      "trailingCommas": "all",
      "arrowParentheses": "always",
      "quoteProperties": "preserve"
    }
  },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true
    }
  }
}
`;

const initCommand = buildCommand({
  docs: {
    brief:
      "Write maaidd.config.json and biome.json if they do not exist; optionally install git hooks",
  },
  parameters: {
    flags: {
      hooks: {
        kind: "boolean",
        optional: true,
        brief: "Install tracked git hooks (sets core.hooksPath=scripts/hooks)",
      },
    },
  } as any,
  func: (flags: any) => {
    const stdout = (s: string) => process.stdout.write(s + "\n");
    const dir = process.cwd();
    const configPath = join(dir, "maaidd.config.json");
    if (!existsSync(configPath)) {
      writeFileSync(configPath, DEFAULT_MAAIDD_CONFIG, "utf8");
      stdout(`Created ${configPath}`);
    } else {
      stdout(`Already exists: ${configPath}`);
    }
    const biomePath = join(dir, "biome.json");
    if (!existsSync(biomePath)) {
      writeFileSync(biomePath, DEFAULT_BIOME_CONFIG, "utf8");
      stdout(`Created ${biomePath}`);
    } else {
      stdout(`Already exists: ${biomePath}`);
    }
    if (flags?.hooks) {
      for (const name of ["pre-commit", "post-commit"]) {
        const hp = join(dir, "scripts", "hooks", name);
        if (existsSync(hp)) {
          try {
            chmodSync(hp, 0o755);
          } catch {}
        }
      }
      try {
        execFileSync("git", ["config", "core.hooksPath", "scripts/hooks"], {
          cwd: dir,
          stdio: ["pipe", "pipe", "ignore"],
        });
        stdout("Installed git hooks (core.hooksPath=scripts/hooks)");
      } catch (e) {
        stdout(
          `Could not set core.hooksPath (install manually: git config core.hooksPath scripts/hooks): ${e instanceof Error ? e.message : String(e)}`,
        );
      }
    }
  },
});

export { initCommand };
