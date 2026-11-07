/**
 * String layout helpers used when embedding multi-line output.
 */

/** Prefix every line of a multi-line string with pad (first line included). */
export function reindent(str, pad) {
  if (!str.includes("\n")) return pad + str;
  return str.split("\n").map((ln) => pad + ln).join("\n");
}

/** Indent only continuation lines (leave first line as-is). */
export function indentContinuations(str, pad) {
  if (!str.includes("\n")) return str;
  const [first, ...rest] = str.split("\n");
  return [first, ...rest.map((ln) => pad + ln)].join("\n");
}
