# CLI reference (`maaidd`)

> Generated with Stricli built-ins (`generateHelpTextForAllCommands`, `formatHelp`). Run `bun scripts/generate-cli-docs.ts`.

## `maaidd`

```text
USAGE
  maaidd format [--style biome|functional] [--indent N|tab] [--line-width N] [--semicolons] [--quote-style double|single] [--trailing-comma all|es5|none] [--to-arrow] [--biome] [--config path] [--output path] <args>...
  maaidd check [--style biome|functional] [--indent N|tab] [--line-width N] [--semicolons] [--quote-style double|single] [--trailing-comma all|es5|none] [--to-arrow] [--biome] [--config path] <args>...
  maaidd metrics [--format table|json|toon|html] [--save] [--pending] [--finalize] [--force] [--tests] [--test-command command] [--exclude-under N] [--config path] <args>...
  maaidd gate [--exclude-under N] [--config path] <args>...
  maaidd report [--output path]
  maaidd mcp
  maaidd graph <args>...
  maaidd init [--hooks]
  maaidd completion install|uninstall ...

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
  init        Write maaidd.config.json and biome.json if they do not exist; optionally install git hooks
  completion  Install or uninstall shell completion for maaidd
```

## `maaidd maaidd format`

```text
USAGE
  maaidd format [--style biome|functional] [--indent N|tab] [--line-width N] [--semicolons] [--quote-style double|single] [--trailing-comma all|es5|none] [--to-arrow] [--biome] [--config path] [--output path] <args>...
  maaidd format --help

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
     [--config]                      Path to maaidd.config.json
     [--output]                      Output file or directory
  -h  --help                         Print help information and exit

ARGUMENTS
  args...  Files or directories to format (default: stdin)
```

## `maaidd maaidd check`

```text
USAGE
  maaidd check [--style biome|functional] [--indent N|tab] [--line-width N] [--semicolons] [--quote-style double|single] [--trailing-comma all|es5|none] [--to-arrow] [--biome] [--config path] <args>...
  maaidd check --help

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
     [--config]                      Path to maaidd.config.json
  -h  --help                         Print help information and exit

ARGUMENTS
  args...  Files or directories to check (default: stdin)
```

## `maaidd maaidd metrics`

```text
USAGE
  maaidd metrics [--format table|json|toon|html] [--save] [--pending] [--finalize] [--force] [--tests] [--test-command command] [--exclude-under N] [--config path] <args>...
  maaidd metrics --help

Run FTA metrics; optionally save tests + metrics for a git commit

FLAGS
     [--format]                  Output format (default: table)                                  [table|json|toon|html]
     [--save/--no-save]          Save tests + FTA metrics for current HEAD (maaidd.db)
     [--pending/--no-pending]    Save a pending snapshot to finalize after a commit
     [--finalize/--no-finalize]  Finalize the pending snapshot using the current HEAD
     [--force/--no-force]        Replace an existing snapshot for the same commit
     [--tests/--no-tests]        Include test-runner counts when saving (use --no-tests to omit) [default = true]
     [--test-command]            Command used to collect test counts
     [--exclude-under]           Exclude files under N lines
     [--config]                  Path to maaidd.config.json
  -h  --help                     Print help information and exit

ARGUMENTS
  args...  Path to analyze (default: src)
```

## `maaidd maaidd gate`

```text
USAGE
  maaidd gate [--exclude-under N] [--config path] <args>...
  maaidd gate --help

Enforce FTA metric thresholds; exits 1 on violations

FLAGS
     [--exclude-under]  Exclude files under N lines
     [--config]         Path to maaidd.config.json
  -h  --help            Print help information and exit

ARGUMENTS
  args...  Path to analyze (default: src)
```

## `maaidd maaidd report`

```text
USAGE
  maaidd report [--output path]
  maaidd report --help

Generate uPlot HTML history dashboard from metric snapshots

FLAGS
     [--output]  Output HTML file (default: stdout)
  -h  --help     Print help information and exit
```

## `maaidd maaidd mcp`

```text
USAGE
  maaidd mcp
  maaidd mcp --help

Start the MCP server (stdio transport) exposing codegraph + metrics tools

FLAGS
  -h --help  Print help information and exit
```

## `maaidd maaidd graph`

```text
USAGE
  maaidd graph <args>...
  maaidd graph --help

Query the code-graph index

FLAGS
  -h --help  Print help information and exit

ARGUMENTS
  args...  Query arguments passed to code-graph
```

## `maaidd maaidd init`

```text
USAGE
  maaidd init [--hooks]
  maaidd init --help

Write maaidd.config.json and biome.json if they do not exist; optionally install git hooks

FLAGS
     [--hooks/--no-hooks]  Install tracked git hooks (sets core.hooksPath=scripts/hooks)
  -h  --help               Print help information and exit
```

## `maaidd maaidd completion install`

```text
USAGE
  maaidd completion install
  maaidd completion install --help

Installs bash autocomplete support for maaidd

FLAGS
  -h --help  Print help information and exit
```

## `maaidd maaidd completion uninstall`

```text
USAGE
  maaidd completion uninstall
  maaidd completion uninstall --help

Uninstalls bash autocomplete support for maaidd

FLAGS
  -h --help  Print help information and exit
```
