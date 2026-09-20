/** Public theme tokens. Layout remains in authored CSS. */
export function defineTheme<T extends Record<string, string>>(defaults: T) {
  for (const [name, value] of Object.entries(defaults)) {
    if (
      !/^[a-zA-Z][a-zA-Z0-9-]*$/.test(name) ||
      typeof value !== "string" ||
      !value.trim() ||
      /[{};]/.test(value)
    )
      throw new Error(`Invalid theme token: ${name}`);
  }
  return {
    defaults: Object.freeze({ ...defaults }),
    vars: Object.fromEntries(Object.keys(defaults).map((key) => [key, `var(--slop-${key})`])) as {
      [K in keyof T]: `var(--slop-${string})`;
    },
    css: `:root{${Object.entries(defaults)
      .map(([key, value]) => `--slop-${key}:${value}`)
      .join(";")}}`,
  };
}
