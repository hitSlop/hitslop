import type { SlopStatement } from "@hitslop/runtime";
export function sql(strings: TemplateStringsArray, ...values: unknown[]): SlopStatement {
  let text = strings[0] ?? ""; const parameters: unknown[] = [];
  values.forEach((value, index) => { text += `?${strings[index + 1] ?? ""}`; parameters.push(value); });
  return { sql: text, parameters };
}
