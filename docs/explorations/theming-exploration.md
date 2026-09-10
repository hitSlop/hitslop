# Exploring styling and theming for hitSlop

Date: 2026-09-09  
Status: Research and discussion only. No styling system selected or POC implemented.

## Purpose

Evaluate the best authoring and theming foundation for hitSlop from scratch.
The discussion began with StyleX, expanded to vanilla-extract Recipes,
Sprinkles, Dynamic, and Panda CSS, and then included UnoCSS and plain Svelte
CSS. Migration costs and compatibility with legacy authoring code are not
decision criteria: the product has not shipped, and we can change the design.

We care about all of the following, rather than optimizing only one:

- Simple, understandable authoring for people and agents.
- Typed styles and useful diagnostics for mistakes.
- Distinctive mini apps with responsive layouts, states, and custom visuals.
- A coherent theme definition with owner-editable values.
- Consistent appearance across editor, portals, export, and icon views.
- Small packaged apps and dependable development/build behavior.
- A framework-neutral runtime package, even if Svelte is the preferred authoring integration.

The current recommendation is to compare **UnoCSS and Panda on the same
complete slop**, with **vanilla-extract + selective Recipes** as the baseline.
StyleX remains interesting, but is a lower priority for this evaluation.
This is a recommendation for investigation, not an adoption decision.

## What the repository currently does

These observations describe the inspected working tree, including ongoing
example changes, rather than asserting a permanent project policy.

- All 11 active slops inspected under `examples/slops/` use vanilla-extract
  through their Vite configurations.
- Quick Checklist defines its public tokens once in root `theme.ts` using
  `defineTheme` from `@hitslop/runtime/theme`.
- The helper returns typed `theme.vars` references and CSS defaults. It is a
  small utility, not a large theme framework.
- The builder emits defaults as immutable `assets/theme.css`. Structural CSS
  is compiled into `app.html`.
- Owners may supply partial overrides in `stores/theme.css`. The host validates
  them and reloads the stylesheet without reloading document state.
- The current defaults/override format is one `:root` block of public
  `--slop-*` properties. Invalid overrides retain the previous valid theme or
  defaults; removing overrides restores defaults.
- `packages/svelte` primarily supplies state adapters and capture helpers, not
  a styling system. Export and icon targets are appended to `document.body`;
  menus also use portals. Theme scope must account for those DOM locations.

Tailwind was used in older templates. Seven archived stylesheets import it:
Notebook, SQLite Field Notes, Habit Heatmap, Subscription Tracker, Expense
Pulse, Countdown Milestones, and Field Notes. No Tailwind references were
found in the current `examples/` source or root lockfile. Saying Quick
Checklist does not use Tailwind is accurate; saying hitSlop never used it is not.

Relevant implementation and documentation:

- [Theme helper](../../packages/runtime/src/theme.ts)
- [Quick Checklist theme](../../examples/slops/quick-checklist/theme.ts)
- [Quick Checklist structural styles](../../examples/slops/quick-checklist/src/styles.css.ts)
- [CLI theme validation](../../packages/cli/src/theme.ts)
- [Build CSS integration](../../packages/cli/src/vite-build-plugin.ts)
- [Storage and theme contract](../storage.md)
- [Package format](../package-format.md)
- [Archived Tailwind example](../../archive/templates/notebook/source/styles.css)

## Separate authoring from document customization

The most durable conclusion is that these are two related but different jobs.

| Layer | Responsibility |
| --- | --- |
| Template authoring | Structural CSS, responsive behavior, component states, composition, and visual effects |
| Document customization | Which values an owner can edit, defaults, validation, persistence, reset behavior, and live application |

Panda, UnoCSS, StyleX, and vanilla-extract can all produce CSS that consumes
custom properties. None automatically supplies hitSlop's document ownership,
storage, or validation behavior.

Even from scratch, favor a small public theme contract expressed at runtime
through CSS variables. A packaged slop should open and respond to theme changes
without its authoring compiler or a development server.

One author-defined source should supply defaults and authoring references.
If we decide to offer generated customization controls, it could also describe
editable settings: colors, font choices, or bounded spacing values. That metadata
and its adapter to the chosen styling library would be hitSlop work, not a
feature obtained automatically by adopting Panda or another library.

Expose a deliberate subset of tokens. Internal measurements and every visual
state do not all need to become owner settings. Support each slop's distinct
visual identity; a common authoring vocabulary need not impose one palette,
spacing scale, or component appearance across the catalog.

Root-level public overrides are a good default because they reach body-mounted
capture targets and portals. Subtree themes require explicit propagation to
those surfaces. A local declaration can also shadow an inherited root value,
so override precedence must be tested rather than assumed.

The exact future theme schema, editable surface, and persistence format remain
open. Retaining CSS variables does not require freezing every current file-format
or API decision.

## Candidates

### vanilla-extract with selective Recipes

vanilla-extract already provides typed CSS objects, normal TypeScript imports,
static CSS generation, and flexible selectors. Its composition API supports
reusing styles, but concatenating arbitrary conflicting classes does not provide
StyleX's per-property last-applied-style guarantee.

Recipes adds typed variants, default variants, and compound variants without
replacing the underlying compiler. For example:

```svelte
<li class={row({ done: task.done, exporting })}>...</li>
```

This is a strong baseline: make component states explicit, replace unnecessary
descendant selectors with direct styles, and share presentation components.
Those improvements should not be credited exclusively to a new styling library.

Advantages:

- Direct access to CSS with comparatively few authoring restrictions.
- Typed variables and straightforward Svelte class bindings.
- Optional abstractions rather than a mandatory full styling framework.
- Static styles become class strings; no browser CSS generator is needed.

Tradeoffs:

- Authors choose how to organize styles, variants, and shared conventions.
- Complex multipart components require coordination across styles or recipes.
- Arbitrary overrides still require understanding CSS precedence.

Sources: [Composition](https://vanilla-extract.style/documentation/style-composition/),
[Recipes](https://vanilla-extract.style/documentation/packages/recipes/).

### Sprinkles and Dynamic

Sprinkles provides configurable typed atomic utilities on top of vanilla-extract.
It could supply a Tailwind-like vocabulary while keeping the existing ecosystem.
Its cost is defining and maintaining the property/value/condition vocabulary.
Keep configurations narrow: the generated utility set grows with the configured
values and conditions. It is not automatically the smallest output for a tiny app.

Sprinkles calls made in `.css.ts` files can be resolved at build time. Calls
made in application code use a runtime lookup of pre-generated classes. The
phrase “zero runtime” should not be read as a guarantee of no styling JavaScript
regardless of usage.

Dynamic provides helpers such as `assignInlineVars` and `setElementVars` for
live CSS-variable updates. It would be useful for a color-picker preview or
other live customization. It does not replace the public theme contract,
validation, or persistence. `setElementVars` skips `null`/`undefined` values;
resetting an already assigned variable needs explicit removal or another reset
mechanism.

Recommendation: Recipes is the first optional addition to evaluate. Add
Sprinkles only if a shared utility vocabulary proves useful, and Dynamic only
where its typed helpers improve live updates.

Sources: [Sprinkles](https://vanilla-extract.style/documentation/packages/sprinkles/),
[Dynamic](https://vanilla-extract.style/documentation/packages/dynamic/).

### StyleX

StyleX generates atomic CSS and provides predictable composition: styles passed
later override conflicting properties. It is particularly attractive for
reusable components accepting constrained style props and many conditional states.
For Svelte, `stylex.attrs()` returns `class` and serialized `style` attributes.
Official documentation includes a SvelteKit integration.

Illustrative application:

```svelte
<span {...stylex.attrs(styles.text, task.done && styles.completed)}>
  {task.text}
</span>
```

Advantages:

- Explicit, predictable style composition.
- Typed styles, style props, and token APIs.
- Atomic declaration deduplication and static CSS output.

Tradeoffs:

- Ahead-of-time compilation restricts imports and expressions used in styles.
- The current imported `theme.vars` object is not directly interchangeable with
  StyleX's supported token imports.
- Component application is more verbose than a plain Svelte class binding.
- Existing selector-based styling would need a different organization.
- Vite compilation, CSS extraction, HMR, and packaging order need verification.

A token adapter is **not required for a minimal POC**: styles can contain literal
`var(--slop-ink)` values while retaining existing defaults. The adapter question
arises when preserving typed token names and one source of truth. StyleX also
supports explicitly named variables through `defineVars`; hashed names are not
an unavoidable limitation.

Its size advantage is unmeasured here. Independent slops do not automatically
deduplicate CSS across their separate packages.

Sources: [Overview](https://stylexjs.com/docs/learn/),
[Compiler constraints](https://stylexjs.com/docs/learn/styling-ui/defining-styles/),
[Attributes](https://stylexjs.com/docs/api/javascript/attrs),
[Named variables](https://stylexjs.com/docs/api/javascript/defineVars),
[Svelte integration](https://stylexjs.com/docs/learn/installation/vite/sveltekit).

### Panda CSS

Panda is the most integrated authoring candidate: typed tokens, semantic tokens,
conditions, utility-style objects, layout patterns, recipes, and slot recipes.
It would normally replace vanilla-extract. Although a token-only mode permits
combining them, we have not identified a benefit that justifies both pipelines.

Slot recipes are especially relevant. A single recipe returns classes for a
component's parts, letting a `done` or `exporting` variant coordinate a row,
checkbox, label, and actions. Svelte can consume those class strings directly.

```ts
const classes = taskRow({ done: task.done, exporting });
// classes.root, classes.checkbox, classes.label, classes.actions
```

Advantages:

- A consistent vocabulary for styling and tokens across authored projects.
- Generated token types and useful authoring diagnostics.
- Built-in coordination of multipart component styles.
- Reusable presets without requiring every slop to share a visual theme.
- Static CSS generation with lightweight runtime authoring helpers.

Tradeoffs:

- Generated `styled-system` code is required for the authoring API and types.
- Source scanning imposes constraints on dynamic values and abstraction patterns.
- Atomic recipes generate declared variants; config recipes emit detected usage.
  Runtime-selected config variants may need explicit pre-generation.
- Arbitrary document-loaded values belong in CSS variables or inline styles,
  rather than dynamically constructed style declarations that the compiler
  cannot discover.

The official Svelte guide scaffolds SvelteKit. hitSlop would use the applicable
PostCSS, scanning, codegen, and CSS-entry pieces with plain Svelte/Vite; it does
not need SvelteKit routing or adapters. Its `prepare` example is not a guarantee
of codegen before every build. Our workflow would explicitly ensure generated
artifacts are ready for checks and builds.

Panda moved ahead of StyleX in the discussion because tokens and multipart
recipes address more of hitSlop's authoring needs. That does not establish it as
the simplest or fastest option without a POC.

Sources: [Architecture](https://panda-css.com/docs/overview/why-panda),
[Tokens](https://panda-css.com/docs/theming/tokens),
[Presets](https://panda-css.com/docs/customization/presets),
[Slot recipes](https://panda-css.com/docs/concepts/slot-recipes),
[Recipe extraction](https://panda-css.com/docs/concepts/recipes),
[Dynamic styling](https://panda-css.com/docs/guides/dynamic-styling),
[Svelte setup](https://panda-css.com/docs/installation/svelte),
[npm lifecycle](https://docs.npmjs.com/cli/v11/using-npm/scripts/).

### UnoCSS

UnoCSS offers a different simplification: utility classes generated on demand,
an extensible preset/rule system, and shortcuts for repeated combinations.
It avoids Panda's generated TypeScript authoring API. Use build-time integration,
not Uno's optional browser runtime, for packaged slops.

With semantic utilities mapped to public CSS variables, authoring could look like:

```svelte
<section class="bg-paper text-ink rounded-[20px] p-[24px]">
  <span class={task.done ? "text-muted line-through" : "text-ink"}>
    {task.text}
  </span>
</section>
```

Advantages:

- Concise markup and a lightweight authoring setup.
- On-demand atomic CSS with no required browser styling engine.
- Theme mappings can refer to owner-editable CSS variables.
- Utility classes can coexist with ordinary CSS for bespoke effects.
- Custom rules and shortcuts can encode a small set of useful conventions.

Tradeoffs:

- Ordinary class strings are not TypeScript-checked like Panda token references.
  Editor assistance is useful but not the same guarantee.
- Runtime interpolation such as `bg-${color}` may not be extracted; use complete
  alternatives, safelists, or CSS variables.
- Shortcuts are not a direct equivalent of typed multipart recipes.
- Too many custom rules or shortcuts create another vocabulary to learn.

Start with the regular Vite plugin, placed before Svelte, and configure the
Svelte extractor when using class directives. Uno's documentation recommends
regular global output for small apps. Its separate Svelte Scoped integration
is more relevant to larger applications and component libraries, with additional
syntax constraints. Each slop already has its own document, so component-scoped
utility output is not an automatic requirement.

Uno must also justify itself against Tailwind itself. Familiar utility syntax
alone is not a reason to choose Uno; custom rules, shortcuts, and integration
fit are the differentiators worth testing. Do not treat historical homepage
speed comparisons as measurements against current Tailwind or our pipeline.

Sources: [Vite/Svelte integration](https://unocss.dev/integrations/vite),
[Theme](https://unocss.dev/config/theme),
[Shortcuts](https://unocss.dev/config/shortcuts),
[Extraction](https://unocss.dev/guide/extracting),
[Svelte Scoped](https://unocss.dev/integrations/svelte-scoped),
[Wind4 preset](https://unocss.dev/presets/wind4).

### Plain Svelte CSS

Scoped `<style>` blocks are a useful simplicity baseline. They place CSS next
to markup without an additional styling library and can consume the same public
theme variables. Tradeoffs include less TypeScript checking of token references
and care when sharing styles across component boundaries. Shared presentation
components can address some of that duplication.

Source: [Svelte scoped styles](https://svelte.dev/docs/svelte/scoped-styles).

## Current assessment

This table reflects architectural judgment, not benchmark results. Migration
effort is deliberately excluded.

| Goal | Strongest candidate or approach |
| --- | --- |
| Concise utility authoring with little setup | UnoCSS |
| Integrated typed authoring and multipart variants | Panda |
| Direct CSS control with selective abstractions | vanilla-extract + Recipes |
| Predictable arbitrary style composition | StyleX |
| Fewest additional styling dependencies | Plain Svelte CSS |
| Durable owner customization | An independent public CSS-variable contract |

The preference evolved as the scope expanded. vanilla-extract initially looked
strongest against StyleX for the current code. Removing migration costs and
examining Panda's tokens and slot recipes made Panda the leading integrated
toolkit candidate. Uno reopened the simplicity question by offering a lighter
utility-oriented authoring experience. There is no evidence yet for a final
overall winner.

Avoid installing all of these as a combined stack. Each comparison should use
a coherent approach so its benefits and costs remain visible.

## Proposed evaluation, not yet implemented

Compare UnoCSS and Panda against the current vanilla-extract implementation
with selective Recipes. Quick Checklist is a useful representative because it
has more than a static button: stored states, third-party controls, portals,
dynamic values, responsive behavior, and separate capture views.

Evaluate the same visual result and behavior in each:

- Task editing, checked/unchecked states, tabs, menus, disabled/highlighted states,
  progress width, long text, empty content, keyboard focus, and reduced motion.
- Narrow and default window widths, full-height export, and icon rendering.
- Shared presentation styles without coupling export to editor-only structure.
- Owner overrides, removal/reset, and consistent application to portals and
  body-mounted capture targets.
- Clean installation, editor types, type checks, HMR, and production builds.
- Runtime-loaded variant values and arbitrary dynamic values, including checking
  that production output contains every required style.
- A source-free runtime package containing all required CSS/JS and no dependency
  on a development endpoint or external styling service.

Measure total CSS and JavaScript, compressed package size, build/check time,
and development feedback. Compare the effort and clarity of the same edits:
change a token, add a state, adjust a responsive rule, and share a visual part
between editor and export. Record missing-style failures and any custom helpers
needed to make the library fit.

Browser previews can establish authoring and UI behavior. Actual native theme
reload and capture fidelity require a separate explicit release-gate check;
browser success alone does not establish those properties.

Adoption should require a clearer complete authoring experience, one source of
theme defaults, reliable production extraction, and correct document behavior.
Fewer CSS bytes or a nicer isolated component example are insufficient by
themselves. No implementation, performance benchmark, or native validation was
performed during this exploration.

## Open decisions

- Whether authors prefer utility strings or typed style objects in daily work.
- How much shared component structure the authoring toolkit should provide.
- Which theme values owners should be able to edit, and whether a generated
  customization UI is a product goal.
- Whether richer token metadata is worth an additional public contract.
- How the CLI should manage generated authoring APIs if Panda is selected.
- Whether Uno's flexibility provides enough value over Tailwind to justify it.
- Whether either challenger improves enough over vanilla-extract + Recipes to
  become the default.
