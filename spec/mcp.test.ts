import { afterAll, afterEach, beforeAll, describe, expect, it } from "bun:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { rmSync } from "node:fs";
import { join } from "node:path";
import { createMcpServer } from "../src/mcp/server.ts";
import { makeTempDir, writeExecutable } from "./test-utils.ts";

const server = createMcpServer();
const client = new Client({ name: "maaidd-spec", version: "1.0.0" });
const temporaryDirs: string[] = [];
const originalCodegraphBin = process.env.CODEGRAPH_BIN;

beforeAll(async () => {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([
    client.connect(clientTransport),
    server.connect(serverTransport),
  ]);
});

afterAll(async () => {
  await Promise.all([client.close(), server.close()]);
});

afterEach(() => {
  if (originalCodegraphBin === undefined) delete process.env.CODEGRAPH_BIN;
  else process.env.CODEGRAPH_BIN = originalCodegraphBin;
  for (const dir of temporaryDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function text(result: any): string {
  return result.content
    .filter((item: any) => item.type === "text")
    .map((item: any) => item.text)
    .join("\n");
}

describe("MCP development tools", () => {
  it("lists analytics and codegraph tools", async () => {
    const result = await client.listTools();
    expect(result.tools.map((tool) => tool.name).sort()).toEqual([
      "codegraph",
      "gate",
      "history",
      "metrics",
    ]);
  });

  it("returns FTA metrics as JSON, TOON, and a table", async () => {
    const json = await client.callTool({
      name: "metrics",
      arguments: { path: "examples", format: "json" },
    });
    const parsed = JSON.parse(text(json));
    expect(parsed.total).toBeGreaterThan(0);
    expect(parsed.metrics[0].file_name).toBeTruthy();

    const toon = await client.callTool({
      name: "metrics",
      arguments: { path: "examples", format: "toon" },
    });
    expect(text(toon)).toContain("files");

    const table = await client.callTool({
      name: "metrics",
      arguments: { path: "examples", format: "table" },
    });
    expect(text(table)).toContain("cyclo=");
  });

  it("reports gate and history analytics", async () => {
    const gate = await client.callTool({
      name: "gate",
      arguments: { path: "examples" },
    });
    expect(text(gate)).toMatch(/Gate (passed|failed)/);

    const history = await client.callTool({ name: "history", arguments: {} });
    expect(text(history)).toMatch(/tests=|No metric history/);
  });

  it("reports codegraph index status", async () => {
    const result = await client.callTool({ name: "codegraph", arguments: {} });
    expect(result.isError).toBeFalsy();
    expect(text(result)).toContain("Code-graph index:");
    expect(text(result)).toContain("Source roots:");
  });

  it("executes codegraph queries with exact arguments", async () => {
    const dir = makeTempDir();
    temporaryDirs.push(dir);
    const binary = join(dir, "fake-codegraph");
    writeExecutable(
      binary,
      `#!/bin/sh
printf 'fake-codegraph'
for arg in "$@"; do printf ' [%s]' "$arg"; done
printf '\\n'
`,
    );
    process.env.CODEGRAPH_BIN = binary;

    const result = await client.callTool({
      name: "codegraph",
      arguments: { args: ["search", "alpha beta"] },
    });
    expect(result.isError).toBeFalsy();
    expect(text(result)).toBe("fake-codegraph [search] [alpha beta]");
  });

  it("returns codegraph command failures as MCP errors", async () => {
    const dir = makeTempDir();
    temporaryDirs.push(dir);
    const binary = join(dir, "failing-codegraph");
    writeExecutable(binary, "#!/bin/sh\necho 'query failed' >&2\nexit 7\n");
    process.env.CODEGRAPH_BIN = binary;

    const result = await client.callTool({
      name: "codegraph",
      arguments: { query: "search thing" },
    });
    expect(result.isError).toBe(true);
    expect(text(result)).toContain("query failed");
  });
});
