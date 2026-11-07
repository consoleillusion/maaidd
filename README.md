# wider-format

Babel-based formatter that restyles JavaScript / TypeScript into **Wider** comma-first layout.

## Install

```bash
cd wider-fmt
bun install   # or: npm install
```

## CLI

```bash
node src/cli.js -i input.js -o output.js
node src/cli.js -i input.js --indent 4 --to-arrow --no-semicolons
cat input.js | node src/cli.js > output.js
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

const out = format(source, {
  indent: 2,
  trailingComma: true,
  semicolons: true,
  toArrow: false,
  filename: "file.js",
});
```

## Architecture

```
source → @babel/parser → optional transforms → custom Wider printer → output
```

- **Parse:** `@babel/parser`
- **Transforms:** plain AST walks (e.g. `--to-arrow`)
- **Print:** `src/printer.js` owns all style (comma-first, indent, semis, single-line params)
