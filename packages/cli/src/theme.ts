import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import postcss, { type Root } from "postcss";

const exists = async (path: string): Promise<boolean> => stat(path).then(() => true).catch(() => false);
const decoder = new TextDecoder("utf-8", { fatal: true });

async function readUTF8(path: string, label: string): Promise<string> {
  try { return decoder.decode(await readFile(path)); }
  catch { throw new Error(`${label} must be UTF-8.`); }
}

export async function readThemeContract(root: string): Promise<Set<string> | undefined> {
  const path = join(root, "assets", "theme.css");
  if (!await exists(path)) return undefined;
  const source = await readUTF8(path, "assets/theme.css");
  const contract = parseTheme(source, "assets/theme.css");
  validateThemeReferences(source, contract, "assets/theme.css");
  return contract;
}

export async function validateThemeOverride(root: string, contract: Set<string> | undefined): Promise<void> {
  const path = join(root, "stores", "theme.css");
  if (!await exists(path)) return;
  if (!contract) throw new Error("stores/theme.css requires an immutable assets/theme.css contract.");
  const source = await readUTF8(path, "stores/theme.css");
  const overrides = parseTheme(source, "stores/theme.css");
  for (const property of overrides) if (!contract.has(property)) throw new Error(`stores/theme.css cannot define unknown theme variable ${property}.`);
  validateThemeReferences(source, contract, "stores/theme.css");
}

export function validateThemeReferences(cssOrHTML: string, contract: Set<string> | undefined, label: string): void {
  const referenced = new Set([...cssOrHTML.matchAll(/var\(\s*(--slop-[a-z0-9-]+)/gi)].map((match) => match[1]!));
  if (!referenced.size) return;
  if (!contract) throw new Error(`${label} references public --slop-* variables but assets/theme.css is missing.`);
  for (const property of referenced) if (!contract.has(property)) throw new Error(`${label} references ${property}, but assets/theme.css does not provide a default.`);
}

export function parseTheme(source: string, label: string): Set<string> {
  let root: Root;
  try { root = postcss.parse(source, { from: label }); }
  catch (error) { throw new Error(`${label} is not valid CSS: ${error instanceof Error ? error.message : String(error)}`); }
  const rules = root.nodes.filter((node) => node.type !== "comment");
  if (rules.length !== 1 || rules[0]?.type !== "rule" || rules[0].selector.trim() !== ":root") {
    throw new Error(`${label} must contain exactly one :root rule.`);
  }
  const properties = new Set<string>();
  for (const node of rules[0].nodes) {
    if (node.type === "comment") continue;
    if (node.type !== "decl") throw new Error(`${label} can contain only custom-property declarations.`);
    if (!/^--slop-[a-z0-9-]+$/.test(node.prop)) throw new Error(`${label} can define only lowercase --slop-* custom properties.`);
    if (!node.value.trim()) throw new Error(`${label} cannot leave ${node.prop} empty.`);
    if (properties.has(node.prop)) throw new Error(`${label} defines ${node.prop} more than once.`);
    properties.add(node.prop);
  }
  if (!properties.size) throw new Error(`${label} must define at least one --slop-* custom property.`);
  return properties;
}
