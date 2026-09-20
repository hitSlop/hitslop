/** Small prototype theme contract; builds emit the defaults as immutable CSS. */
export function defineTheme<T extends Record<string, string>>(defaults: T) {
  return {
    vars: Object.fromEntries(Object.keys(defaults).map((key) => [key, `var(--slop-${key})`])) as {
      [K in keyof T]: `var(--slop-${string})`;
    },
    css: `:root{${Object.entries(defaults)
      .map(([key, value]) => `--slop-${key}:${value}`)
      .join(";")}}`,
  };
}
