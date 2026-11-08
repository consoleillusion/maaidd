import { describe, expect, it } from "bun:test";
import { format } from "../src/index.ts";

const functional = { style: "functional" as const };

describe("functional printer syntax coverage", () => {
  it("preserves TypeScript declarations and remains idempotent", () => {
    const source = `interface Config { host: string; port: number; nested: { enabled: boolean; retries: number } }
const config: Config = { host: "localhost", port: 8080, nested: { enabled: true, retries: 3 } };`;
    const options = { ...functional, filename: "config.ts" };
    const once = format(source, options);
    expect(once).toContain("interface Config");
    expect(once).toContain("host: string");
    expect(once).toContain("port: number");
    expect(once).toContain("enabled: boolean");
    expect(once).toContain("const config: Config");
    expect(once).not.toContain("/* TS");
    expect(format(once, options)).toBe(once);
  });

  it("preserves JSX and comments", () => {
    const source = `// Application component
const App = () => <div className="app"><span>Hello</span></div>;`;
    const options = { ...functional, filename: "App.tsx" };
    const once = format(source, options);
    expect(once).toContain("// Application component\nconst App");
    expect(once.match(/\/\/ Application component/g)).toHaveLength(1);
    expect(once).toContain('<div className="app"><span>Hello</span></div>');
    expect(once).not.toMatch(/\n[ \t]*\n/);
    expect(format(once, options)).toBe(once);
  });

  it("normalizes quotes through Biome before applying functional layout", () => {
    const source =
      "const value = { message: 'hello', description: 'long enough to expand this object with another property' };";
    const output = format(source, {
      ...functional,
      filename: "value.ts",
      quoteStyle: "single",
    });
    expect(output).toContain("'hello'");
    expect(output).not.toContain('"hello"');
  });

  it("can remove semicolons after the Biome normalization pass", () => {
    const output = format("const value = 1;", {
      ...functional,
      filename: "value.ts",
      semicolons: false,
    });
    expect(output.trim()).toBe("const value = 1");
  });

  it("keeps operator chains and nested arrays idempotent", () => {
    const source =
      "const result = firstValue + secondValue + thirdValue + fourthValue + fifthValue; const values = [[1, 2, 3, 4], [5, 6, 7, 8]];";
    const options = { ...functional, filename: "math.ts", lineWidth: 40 };
    const once = format(source, options);
    expect(format(once, options)).toBe(once);
  });
});
