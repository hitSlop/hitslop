import type { SlopStatement } from "@slop/runtime";

export function sql(
  strings: TemplateStringsArray,
  ...values: unknown[]
): SlopStatement {
  let text = strings[0] ?? "";
  const parameters: unknown[] = [];
  for (let index = 0; index < values.length; index += 1) {
    text += `?${strings[index + 1] ?? ""}`;
    parameters.push(values[index]);
  }
  return { sql: text, parameters };
}
