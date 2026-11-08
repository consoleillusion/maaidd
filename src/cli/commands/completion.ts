/**
 * `maaidd completion install|uninstall` — bash completion.
 */
import { buildCommand, buildRouteMap } from "@stricli/core";
import {
  buildInstallCommand,
  buildUninstallCommand,
} from "@stricli/auto-complete";
import type { MaaiddContext } from "../context.ts";
const bashCompletionScript = `
_maaidd_completions() {
  local cur="\${COMP_WORDS[COMP_CWORD]}"
  local cmds="format check metrics gate report mcp graph init completion --help --version"
  if [ "\$COMP_CWORD" -eq 1 ]; then
    COMPREPLY=(\$(compgen -W "\$cmds" -- "\$cur"))
  fi
}
complete -F _maaidd_completions maaidd
`.trim();
const installCmd = buildInstallCommand("maaidd", {
  bash: bashCompletionScript,
});
const uninstallCmd = buildUninstallCommand("maaidd", { bash: true });
const completionCommand = buildRouteMap({
  routes: { install: installCmd, uninstall: uninstallCmd },
  docs: { brief: "Install or uninstall shell completion for maaidd" },
});
export { completionCommand };
