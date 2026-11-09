/**
 * MAID CLI context.
 */
import type { CommandContext } from "@stricli/core";
// Use the base CommandContext; command functions access process via the global.
export type MaidContext = CommandContext;
