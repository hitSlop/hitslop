/** Plain CSS variables: usable by vanilla-extract or any other styling system. */
export function defineTheme<const Tokens extends Record<string, string>>(tokens: Tokens) {
  const vars = {} as { readonly [Key in keyof Tokens]: `var(--slop-${string})` };
  const declarations: string[] = [];
  const names = new Set<string>();
  for (const [key, value] of Object.entries(tokens)) {
    const name = `--slop-${key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`;
    if (!/^--slop-[a-z][a-z0-9-]*$/.test(name) || names.has(name)) throw new Error(`Invalid or duplicate theme token: ${key}`);
    if (!value.trim() || /[{};]|\/\*|<\/style/i.test(value)) throw new Error(`Invalid theme value for ${key}`);
    names.add(name);
    Object.assign(vars, { [key]: `var(${name})` });
    declarations.push(`  ${name}: ${value};`);
  }
  if (!names.size) throw new Error("A theme needs at least one token");
  return Object.freeze({ vars: Object.freeze(vars), css: `:root {\n${declarations.join("\n")}\n}\n` });
}
