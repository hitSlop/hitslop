export type ThemeValues = Record<string, string>;
export class ThemeController {
  private overrides: ThemeValues = {};
  constructor(
    private defaults: ThemeValues,
    private save: (values: ThemeValues) => Promise<void>,
    private apply: (values: ThemeValues) => void = () => {},
  ) {}
  private validate(values: ThemeValues) {
    if (!values || Array.isArray(values) || typeof values !== "object")
      throw new Error("Expected a theme token object");
    if (new TextEncoder().encode(JSON.stringify(values)).length > 65536)
      throw new Error("Theme exceeds 64 KiB");
    for (const [key, value] of Object.entries(values)) {
      if (!Object.hasOwn(this.defaults, key)) throw new Error(`Unknown theme token: ${key}`);
      if (typeof value !== "string" || !value.trim() || value.length > 4096 || /[{};]/.test(value))
        throw new Error(`Invalid theme value: ${key}`);
      if (typeof document !== "undefined") {
        const style = document.createElement("span").style;
        style.setProperty(`--slop-${key}`, value);
        if (!style.getPropertyValue(`--slop-${key}`)) throw new Error(`Invalid CSS value: ${key}`);
      }
      for (const ref of value.matchAll(/var\(\s*--slop-([a-zA-Z0-9-]+)/g))
        if (!Object.hasOwn(this.defaults, ref[1]!))
          throw new Error(`Unknown theme reference: ${ref[1]}`);
    }
  }
  load(values: ThemeValues) {
    this.validate(values);
    this.overrides = { ...values };
    this.apply(this.get().effective);
  }
  get() {
    return {
      defaults: { ...this.defaults },
      overrides: { ...this.overrides },
      effective: { ...this.defaults, ...this.overrides },
    };
  }
  async set(values: ThemeValues) {
    this.validate(values);
    const next = { ...this.overrides, ...values };
    this.validate(next);
    await this.save(next);
    this.load(next);
    return this.get();
  }
  async reset(token?: string) {
    if (token !== undefined && !Object.hasOwn(this.defaults, token))
      throw new Error(`Unknown theme token: ${token}`);
    const next = token === undefined ? {} : { ...this.overrides };
    if (token !== undefined) delete next[token];
    await this.save(next);
    this.load(next);
    return this.get();
  }
}
export async function openTheme(native: boolean) {
  const response = await fetch("/assets/theme.json");
  if (!response.ok) throw new Error("Missing theme defaults");
  const defaults = await response.json();
  const call = (args: Record<string, unknown>) =>
    (globalThis as any).webkit.messageHandlers.storage.postMessage(args);
  const theme = new ThemeController(
    defaults,
    async (values) => {
      if (native) await call({ method: "theme.save", values });
    },
    (values) => {
      for (const [key, value] of Object.entries(values))
        document.documentElement.style.setProperty(`--slop-${key}`, value);
    },
  );
  theme.load(native ? (await call({ method: "theme.load" })).values : {});
  return theme;
}
