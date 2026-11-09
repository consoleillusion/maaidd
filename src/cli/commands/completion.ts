/**
 * `maid completion install|uninstall` — bash completion.
 */
import { buildCommand, buildRouteMap } from "@stricli/core";
import {
  buildInstallCommand,
  buildUninstallCommand,
} from "@stricli/auto-complete";
import type { MaidContext } from "../context.ts";
const bashCompletionScript = `
_maid_completions() {
  local cur="\${COMP_WORDS[COMP_CWORD]}"
  local cmds="format check metrics gate report mcp graph init completion --help --version"
  if [ "\$COMP_CWORD" -eq 1 ]; then
    COMPREPLY=(\$(compgen -W "\$cmds" -- "\$cur"))
  fi
}
complete -F _maid_completions maid
`.trim();
const installCmd = buildInstallCommand("maid", {
  bash: bashCompletionScript,
});
const uninstallCmd = buildUninstallCommand("maid", { bash: true });
const completionCommand = buildRouteMap({
  routes: { install: installCmd, uninstall: uninstallCmd },
  docs: { brief: "Install or uninstall shell completion for maid" },
});
export { completionCommand };
