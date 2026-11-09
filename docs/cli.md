# CLI reference (`maid`)

> Generated with Stricli built-ins (`generateHelpTextForAllCommands`, `formatHelp`). Run `bun scripts/generate-cli-docs.ts`.

## `maid`

```text
USAGE
  maid format [--style biome|functional] [--indent N|tab] [--line-width N] [--semicolons] [--quote-style double|single] [--trailing-comma all|es5|none] [--to-arrow] [--biome] [--config path] [--output path] <args>...
  maid check [--style biome|functional] [--indent N|tab] [--line-width N] [--semicolons] [--quote-style double|single] [--trailing-comma all|es5|none] [--to-arrow] [--biome] [--config path] <args>...
  maid metrics [--format table|json|toon|html] [--save] [--pending] [--finalize] [--force] [--tests] [--test-command command] [--exclude-under N] [--config path] <args>...
  maid gate [--exclude-under N] [--config path] <args>...
  maid report [--output path]
  maid mcp
  maid graph <args>...
  maid init [--yes] [--non-interactive] [--force] [--write-config] [--format] [--format-path value] [--accept-git-hooks] [--hooks] [--reject-git-hooks] [--style biome|functional] [--indent value] [--line-width value] [--semicolons] [--quote-style double|single] [--trailing-comma all|es5|none] [--to-arrow] [--biome] [--functional-comma-style leading|trailing] [--functional-object-value-indent value] [--functional-array-value-indent value] [--functional-force-blank-lines] [--functional-semicolons] [--functional-max-inline-array-items value] [--metrics-exclude-under value] [--metrics-test-command value] [--metrics-max-cyclomatic value] [--metrics-min-fta-score value] [--mcp-codegraph] [--mcp-metrics]
  maid completion install|uninstall ...

Biome-first formatting, optional Dhall/Haskell-style leading commas, FTA code metrics, gates, uplot history reports, and an MCP server exposing codegraph + analytics.

FLAGS
   --  All subsequent inputs should be interpreted as arguments

COMMANDS
  format      Format files, directories, or stdin with Biome or functional style
  check       Check formatting without writing; exits 1 if any file would change
  metrics     Run FTA metrics; optionally save tests + metrics for a git commit
  gate        Enforce FTA metric thresholds; exits 1 on violations
  report      Generate uPlot HTML history dashboard from metric snapshots
  mcp         Start the MCP server (stdio transport) exposing codegraph + metrics tools
  graph       Query the code-graph index
  init        Initialize MAID (maid.config.json, biome.json, git hooks, optional formatting)
  completion  Install or uninstall shell completion for maid
```

## `maid maid format`

```text
USAGE
  maid format [--style biome|functional] [--indent N|tab] [--line-width N] [--semicolons] [--quote-style double|single] [--trailing-comma all|es5|none] [--to-arrow] [--biome] [--config path] [--output path] <args>...
  maid format --help

Format files, directories, or stdin with Biome or functional style

FLAGS
     [--style]                       Formatting style (default: biome)                               [biome|functional]
     [--indent]                      Indent width (2|4|8|tab)
     [--line-width]                  Maximum line width
     [--semicolons/--no-semicolons]  Emit semicolons (use --no-semicolons to omit)                   [default = true]
     [--quote-style]                 Quote style                                                     [double|single]
     [--trailing-comma]              Trailing comma style                                            [all|es5|none]
     [--to-arrow/--no-to-arrow]      Convert function declarations to const arrows (functional only)
     [--biome/--no-biome]            Pass through Biome (use --no-biome for functional-only)         [default = true]
     [--config]                      Path to maid.config.json
     [--output]                      Output file or directory
  -h  --help                         Print help information and exit

ARGUMENTS
  args...  Files or directories to format (default: stdin)
```

## `maid maid check`

```text
USAGE
  maid check [--style biome|functional] [--indent N|tab] [--line-width N] [--semicolons] [--quote-style double|single] [--trailing-comma all|es5|none] [--to-arrow] [--biome] [--config path] <args>...
  maid check --help

Check formatting without writing; exits 1 if any file would change

FLAGS
     [--style]                       Formatting style (default: biome)                               [biome|functional]
     [--indent]                      Indent width (2|4|8|tab)
     [--line-width]                  Maximum line width
     [--semicolons/--no-semicolons]  Expect semicolons (use --no-semicolons)                         [default = true]
     [--quote-style]                 Quote style                                                     [double|single]
     [--trailing-comma]              Trailing comma style                                            [all|es5|none]
     [--to-arrow/--no-to-arrow]      Convert function declarations to const arrows (functional only)
     [--biome/--no-biome]            Pass through Biome (use --no-biome for functional-only)         [default = true]
     [--config]                      Path to maid.config.json
  -h  --help                         Print help information and exit

ARGUMENTS
  args...  Files or directories to check (default: stdin)
```

## `maid maid metrics`

```text
USAGE
  maid metrics [--format table|json|toon|html] [--save] [--pending] [--finalize] [--force] [--tests] [--test-command command] [--exclude-under N] [--config path] <args>...
  maid metrics --help

Run FTA metrics; optionally save tests + metrics for a git commit

FLAGS
     [--format]                  Output format (default: table)                                  [table|json|toon|html]
     [--save/--no-save]          Save tests + FTA metrics for current HEAD (maid.db)
     [--pending/--no-pending]    Save a pending snapshot to finalize after a commit
     [--finalize/--no-finalize]  Finalize the pending snapshot using the current HEAD
     [--force/--no-force]        Replace an existing snapshot for the same commit
     [--tests/--no-tests]        Include test-runner counts when saving (use --no-tests to omit) [default = true]
     [--test-command]            Command used to collect test counts
     [--exclude-under]           Exclude files under N lines
     [--config]                  Path to maid.config.json
  -h  --help                     Print help information and exit

ARGUMENTS
  args...  Path to analyze (default: src)
```

## `maid maid gate`

```text
USAGE
  maid gate [--exclude-under N] [--config path] <args>...
  maid gate --help

Enforce FTA metric thresholds; exits 1 on violations

FLAGS
     [--exclude-under]  Exclude files under N lines
     [--config]         Path to maid.config.json
  -h  --help            Print help information and exit

ARGUMENTS
  args...  Path to analyze (default: src)
```

## `maid maid report`

```text
USAGE
  maid report [--output path]
  maid report --help

Generate uPlot HTML history dashboard from metric snapshots

FLAGS
     [--output]  Output HTML file (default: stdout)
  -h  --help     Print help information and exit
```

## `maid maid mcp`

```text
USAGE
  maid mcp
  maid mcp --help

Start the MCP server (stdio transport) exposing codegraph + metrics tools

FLAGS
  -h --help  Print help information and exit
```

## `maid maid graph`

```text
USAGE
  maid graph <args>...
  maid graph --help

Query the code-graph index

FLAGS
  -h --help  Print help information and exit

ARGUMENTS
  args...  Query arguments passed to code-graph
```

## `maid maid init`

```text
USAGE
  maid init [--yes] [--non-interactive] [--force] [--write-config] [--format] [--format-path value] [--accept-git-hooks] [--hooks] [--reject-git-hooks] [--style biome|functional] [--indent value] [--line-width value] [--semicolons] [--quote-style double|single] [--trailing-comma all|es5|none] [--to-arrow] [--biome] [--functional-comma-style leading|trailing] [--functional-object-value-indent value] [--functional-array-value-indent value] [--functional-force-blank-lines] [--functional-semicolons] [--functional-max-inline-array-items value] [--metrics-exclude-under value] [--metrics-test-command value] [--metrics-max-cyclomatic value] [--metrics-min-fta-score value] [--mcp-codegraph] [--mcp-metrics]
  maid init --help

Interactive by default in a TTY. Default config is Biome; enabling functional style enables additional functional options. Every maid.config.json option can be set via explicit CLI flags. Destructive actions (formatting/force overwrite) require confirmation or explicit flags. Git hooks: prompted for y (accept) or anything else (decline) unless --accept-git-hooks/--no-hooks is provided.

FLAGS
  -y [--yes/--no-yes]                                                    Accept safe defaults non-interactively (does not format or force overwrite)
     [--non-interactive/--no-non-interactive]                            Disable prompts; requires explicit flags for hooks/destructive actions
     [--force/--no-force]                                                Overwrite existing config files when writing
     [--write-config/--no-write-config]                                  Write maid.config.json and biome.json
     [--format/--no-format]                                              Run initial formatting (destructive; explicit opt-in)
     [--format-path]                                                     Path to format when --format is set (default: .)
     [--accept-git-hooks/--no-accept-git-hooks]                          Install git pre/post commit hooks without prompting
     [--hooks/--no-hooks]                                                Install git hooks (alias for --accept-git-hooks; use --no-hooks to decline)
     [--reject-git-hooks/--no-reject-git-hooks]                          Do not install git hooks without prompting
     [--style]                                                           Formatting style (default: biome)                                           [biome|functional]
     [--indent]                                                          Indent width (2|4|8|tab)
     [--line-width]                                                      Maximum line width
     [--semicolons/--no-semicolons]                                      Emit semicolons
     [--quote-style]                                                     Quote style                                                                 [double|single]
     [--trailing-comma]                                                  Trailing comma style                                                        [all|es5|none]
     [--to-arrow/--no-to-arrow]                                          Convert to const arrows in functional pipeline
     [--biome/--no-biome]                                                Enable Biome pass
     [--functional-comma-style]                                          Functional comma style                                                      [leading|trailing]
     [--functional-object-value-indent]                                  Functional object value indent
     [--functional-array-value-indent]                                   Functional array value indent
     [--functional-force-blank-lines/--no-functional-force-blank-lines]  Functional force blank lines
     [--functional-semicolons/--no-functional-semicolons]                Functional semicolons
     [--functional-max-inline-array-items]                               Functional max inline array items
     [--metrics-exclude-under]                                           Metrics exclude-under threshold
     [--metrics-test-command]                                            Test command for metrics snapshots
     [--metrics-max-cyclomatic]                                          Gate max cyclomatic complexity
     [--metrics-min-fta-score]                                           Gate minimum FTA score
     [--mcp-codegraph/--no-mcp-codegraph]                                Enable MCP codegraph tool/config flag
     [--mcp-metrics/--no-mcp-metrics]                                    Enable MCP metrics tool/config flag
  -h  --help                                                             Print help information and exit
```

## `maid maid completion install`

```text
USAGE
  maid completion install
  maid completion install --help

Installs bash autocomplete support for maid

FLAGS
  -h --help  Print help information and exit
```

## `maid maid completion uninstall`

```text
USAGE
  maid completion uninstall
  maid completion uninstall --help

Uninstalls bash autocomplete support for maid

FLAGS
  -h --help  Print help information and exit
```
