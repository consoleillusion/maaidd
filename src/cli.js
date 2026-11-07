#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { format } from "./index.js";

function help() {
  console.log(`
wider-format – Wider-style comma-first JS/TS formatter (Babel)

Usage:
  wider-format -i input.js -o output.js
  wider-format --input input.js --output output.js
  wider-format -i input.js --indent 4 --to-arrow --no-semicolons
  cat file.js | wider-format > out.js

Options:
  -i, --input <file>        Input file (default: stdin)
  -o, --output <file>       Output file (default: stdout)
  --indent <2|4|8|tab>      Indent unit (default: 2)
  --trailing-comma          Leading comma on final list items (default)
  --no-trailing-comma       No leading comma on final list items
  --semicolons              Keep semicolons (default)
  --no-semicolons           Strip semicolons
  --to-arrow                Convert function declarations to const arrows
  -h, --help                Show help
`);
}

function main(argv) {
  let inputPath = null;
  let outputPath = null;
  let indent = 2;
  let trailingComma = true;
  let semicolons = true;
  let toArrow = false;

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "-h" || a === "--help") {
      help();
      process.exit(0);
    } else if (a === "-i" || a === "--input") {
      inputPath = argv[++i];
    } else if (a === "-o" || a === "--output") {
      outputPath = argv[++i];
    } else if (a === "--indent") {
      const v = argv[++i];
      if (v === "tab") indent = "tab";
      else {
        const n = Number(v);
        if (![2, 4, 8].includes(n)) {
          console.error(`Invalid --indent: ${v}`);
          process.exit(1);
        }
        indent = n;
      }
    } else if (a === "--trailing-comma") {
      trailingComma = true;
    } else if (a === "--no-trailing-comma") {
      trailingComma = false;
    } else if (a === "--semicolons") {
      semicolons = true;
    } else if (a === "--no-semicolons") {
      semicolons = false;
    } else if (a === "--to-arrow") {
      toArrow = true;
    } else if (!a.startsWith("-") && !inputPath) {
      inputPath = a;
    } else {
      console.error(`Unknown argument: ${a}`);
      help();
      process.exit(1);
    }
  }

  let source;
  if (inputPath) {
    source = readFileSync(inputPath, "utf8");
  } else {
    source = readFileSync(0, "utf8"); // stdin
  }

  if (!source.trim()) {
    console.error("No input provided");
    process.exit(1);
  }

  let result;
  try {
    result = format(source, {
      indent,
      trailingComma,
      semicolons,
      toArrow,
      filename: inputPath || "stdin.js",
    });
  } catch (err) {
    console.error("Format error:", err.message || err);
    process.exit(1);
  }

  if (outputPath) {
    writeFileSync(outputPath, result, "utf8");
  } else {
    process.stdout.write(result);
  }
}

main(process.argv.slice(2));
