# Scoped styles for slops

Use Vanilla Extract's `style()` as the default for elements the app owns. The
exported class creates an explicit connection between a style and its Svelte
consumer. Keep the visual identity specific to the object; this is a source
organization convention, not a shared appearance.

## Organize around elements

- Keep public defaults in root `theme.ts` using `defineTheme`. Read `theme.vars`
  in styles; builds generate immutable `assets/theme.css`, and owners override
  the public CSS variables in `stores/theme.css`.
- Start with one `src/styles.css.ts`, grouped by surface, working area, controls,
  and capture views. Split along real component boundaries when a file becomes
  difficult to navigate. Avoid adding Recipes or Sprinkles just to organize a
  small object.
- Export named `style()` classes; consume them with `import * as s from
  "./styles.css"` and `class={s.action}`. TypeScript can then check style imports
  and references instead of relying on matching literal class-name strings.
- Keep `:hover`, `:focus-visible`, state selectors, and media/container queries
  in the same declaration as the base element. Prefer readable property groups
  over dense one-line blocks.
- Use `style([base, overrides])` for actual shared structure. For a few named
  visual variants, `styleVariants()` is optional. Do not force unrelated
  controls or slops through one base style.
- Use `globalStyle()` for `html`, `body`, root layout, resets, and necessary
  descendants you cannot conveniently class directly. Anchor those descendant
  selectors to an exported scoped parent; avoid unqualified global component
  names or page-wide Bits selectors.

## Bits UI keeps behavior; the slop supplies its appearance

Give the primitive a local class and select its documented state on that same
element. This preserves Bits UI's accessibility behavior and allows expressive
styling without broad global selectors.

```ts
// src/styles.css.ts
import { globalStyle, style } from "@vanilla-extract/css";
import theme from "../theme";

const t = theme.vars;
globalStyle("html, body", { margin: 0 });

export const modeTrigger = style({
  minHeight: 44,
  padding: "0 12px",
  border: 0,
  color: t.ink,
  background: "transparent",
  ":focus-visible": { outline: `2px solid ${t.accent}`, outlineOffset: 2 },
  selectors: {
    '&[data-state="active"]': { background: t.panel },
    "&:hover:not(:disabled)": { color: t.accent },
  },
  "@container": {
    "(max-width: 360px)": { paddingInline: 8 },
  },
});
```

```svelte
<script lang="ts">
  import { Tabs } from "bits-ui";
  import * as s from "./styles.css";
</script>

<Tabs.Root value="focus">
  <Tabs.List aria-label="Timer mode">
    <Tabs.Trigger class={s.modeTrigger} value="focus">Focus</Tabs.Trigger>
    <Tabs.Trigger class={s.modeTrigger} value="rest">Break</Tabs.Trigger>
  </Tabs.List>
</Tabs.Root>
```

Use tokens actually declared in the project's theme. A `selectors` entry must
target its own `&`; parent context belongs on the child's rule, for example
``selectors: { [`${panel} &`]: { ... } }``. Use a scoped `globalStyle()` descendant
rule only when direct element classes are impractical.

For a styling-only refactor, preserve theme token names, data attributes, state
behavior, and editor/export/icon appearance. Verify the built result because
class composition and selector specificity can change the cascade.

Sources: [style](https://vanilla-extract.style/documentation/api/style/),
[selectors and queries](https://vanilla-extract.style/documentation/styling/),
[globalStyle](https://vanilla-extract.style/documentation/global-api/global-style/).
