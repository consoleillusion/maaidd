/** Format insight payloads identically for CLI and MCP consumers. */
import { encode } from "@toon-format/toon";

export type InsightFormat = "json" | "toon";

export function renderInsight(
  payload: unknown,
  format: InsightFormat = "json",
): string {
  return format === "toon"
    ? encode(payload as Record<string, unknown>)
    : JSON.stringify(payload, null, 2);
}
