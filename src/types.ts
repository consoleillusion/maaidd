export type Style = "biome" | "functional";
export type Indent = number | "tab";
export type CommaStyle = "leading" | "trailing";
export type QuoteStyle = "double" | "single";
export type TrailingComma = "all" | "es5" | "none";
export interface FunctionalOptions {
  commaStyle: CommaStyle;
  objectValueIndent: number;
  arrayValueIndent: number;
  forceBlankLines: boolean;
  semicolons: boolean;
  maxInlineArrayItems: number;
}
export interface MetricsThresholds {
  maxCyclomatic: number;
  minFtaScore: number;
}
export interface MetricsOptions {
  excludeUnder: number;
  testCommand: string;
  thresholds: MetricsThresholds;
}
export interface McpOptions {
  codegraph: boolean;
  metrics: boolean;
}
export interface MaaiddConfig {
  style: Style;
  indent: Indent;
  lineWidth: number;
  semicolons: boolean;
  quoteStyle: QuoteStyle;
  trailingComma: TrailingComma;
  toArrow: boolean;
  biome: boolean;
  functional: FunctionalOptions;
  metrics: MetricsOptions;
  mcp: McpOptions;
}
export interface FormatOptions {
  style?: Style;
  indent?: Indent;
  lineWidth?: number;
  semicolons?: boolean;
  quoteStyle?: QuoteStyle;
  trailingComma?: TrailingComma;
  toArrow?: boolean;
  biome?: boolean;
  filename?: string;
  typescript?: boolean;
  configPath?: string;
  functional?: Partial<FunctionalOptions>;
}
export interface ResolvedFormatOptions {
  style: Style;
  indent: Indent;
  lineWidth: number;
  semicolons: boolean;
  quoteStyle: QuoteStyle;
  trailingComma: TrailingComma;
  toArrow: boolean;
  biome: boolean;
  filename: string;
  typescript: boolean;
  configPath?: string;
  functional: FunctionalOptions;
}
export const DEFAULT_CONFIG: MaaiddConfig = {
  style: "biome",
  indent: 2,
  lineWidth: 80,
  semicolons: true,
  quoteStyle: "double",
  trailingComma: "all",
  toArrow: false,
  biome: true,
  functional: {
    commaStyle: "leading",
    objectValueIndent: 1,
    arrayValueIndent: 2,
    forceBlankLines: true,
    semicolons: true,
    maxInlineArrayItems: 3,
  },
  metrics: {
    excludeUnder: 0,
    testCommand: "bun run test",
    thresholds: { maxCyclomatic: 20, minFtaScore: 50 },
  },
  mcp: { codegraph: true, metrics: true },
};
