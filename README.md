# Formatter

Babel-based formatter that restyles JavaScript / TypeScript into leading comma-first layout. It also measures the complexity

## Install

```bash
cd formatter-ts
bun install   # or: npm install
```

## CLI

```bash
node src/cli.js -i input.js -o output.js
node src/cli.js -i input.js --indent 4 --to-arrow --no-semicolons
bun 
```

| Flag | Description | Default |
|------|-------------|---------|
| `-i, --input` | Input file | stdin |
| `-o, --output` | Output file | stdout |
| `--indent 2\|4\|8\|tab` | Indent unit | `2` |
| `--trailing-comma` | Leading comma on final list items | on |
| `--no-trailing-comma` | No leading comma on last item | |
| `--semicolons` | Emit semicolons | on |
| `--no-semicolons` | Omit semicolons | |
| `--to-arrow` | `function foo()` → `const foo = () =>` | off |

## Library

```js
import { format } from "./src/index.js";

const out = format(source,
  { indent: 2
  , trailingComma: true
  , semicolons: true
  , toArrow: false
  , filename: "file.js"
  })
```

## Architecture

```
source → @babel/parser → optional transforms → custom printer → output
```

- **Parse:** `@babel/parser`
- **Transforms:** plain AST walks (e.g. `--to-arrow`)
- **Print:** the `src/printer/` modules own all style (comma-first, indent, semis, single-line params)

```
src/printer/
  index.js       entry point: options, context, print()
  dispatch.js    node-type → handler switch (recursive printNode)
  context.js     indent unit + semicolon helpers
  layout.js      reindent / continuation-line helpers
  literals.js    literals, templates, property keys
  functions.js   functions, arrows, parameter lists
  objects.js     objects, arrays, destructuring patterns
  statements.js  variables, blocks, if/loops, try/catch
  expressions.js calls, member access
  classes.js     classes, methods, properties
  modules.js     imports/exports
```
