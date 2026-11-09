/**
 * `maid mcp` — start the MCP server (stdio transport).
 */
import { buildCommand } from "@stricli/core";
import { runMcpServer } from "../../mcp/server.ts";
const mcpCommand = buildCommand({
  docs: {
    brief:
      "Start the MCP server (stdio transport) exposing codegraph + metrics tools",
  },
  parameters: {},
  func: async () => {
    await runMcpServer();
  },
});
export { mcpCommand };
