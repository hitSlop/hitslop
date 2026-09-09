import type { SlopStatement, SQLValue } from "./types.ts";

/** Tagged template that turns interpolated values into positional `?` parameters. */
export function sql(strings: TemplateStringsArray, ...values: SQLValue[]): SlopStatement {
  let text = strings[0] ?? "";
  const parameters: SQLValue[] = [];
  values.forEach((value, index) => {
    text += `?${strings[index + 1] ?? ""}`;
    parameters.push(value);
  });
  return { sql: text, parameters };
}
