# Design and presentation

A memorable slop starts with a job, then chooses an object language. The local
images in `_vibe/` are the project's visual reference library: use their sense
of tactile, single-purpose software, but do not copy or ship them.

## The shared language

**One job, immediately understood, with a character of its own.** Design each
slop as a complete digital object. The collection shares standards of clarity
and craft; each object chooses its own palette, type, composition, and material.
Physical objects and retro software are optional sources of expression.

Focus Timer is the first working design pilot, approved by the user on
September 10, 2026 as “EXACTLY the right vision.” Carry forward its clarity and
commitment to one object; choose a fresh identity for the next example. Continue
one example at a time so the user's judgment guides the collection.
Product context lives in `examples/slops/PRODUCT.md`. A slop's own `DESIGN.md`
records its actual visual decisions and must not become another slop's default.

### Begin with a sentence

Write “This slop helps someone ___.” Name the primary action or working surface,
the information that matters at a glance, and what completion looks like. If
the sentence needs several unrelated verbs, narrow the object before styling.

Choose a visual idea that helps that sentence: a timer's dial shows time, a
receipt organizes money, a vessel shows quantity. Typography and graphic
composition can carry the idea as well as a physical metaphor. Pick one
memorable detail tied to the job and make it work throughout the interface.

### Five principles

1. **Make the purpose visible.** Put the actual task in the first viewport.
   Prioritize one readout, action, or working surface; let secondary information
   recede. The user should know what to do without explanatory onboarding.
2. **Keep behavior familiar.** A button presses, a tab selects, a slider adjusts.
   Use accessible headless primitives with the object's own styling. Decorative
   features must not look like controls, and real controls must look operable.
3. **Make state readable.** Distinguish ready, active, paused, complete, and error
   states with words and structure as well as color. A paused timer keeps its
   time. Count labels must say what the stored data actually represents.
4. **Let purpose shape expression.** Choose the silhouette, material, type, and
   palette together. Use depth to reveal recesses and pressed controls. A paper
   document can stay flat; an instrument can feel tactile. No obligatory retro
   chrome, generic app-card shell, or collection-wide accent color.
5. **Earn compactness.** Start at the manifest dimensions with realistic content.
   Remove competing elements before shrinking labels. Default to at least 12px
   supporting text, 14px control labels, and 44px action targets. Keep controls
   and focus rings within the visible shape, with sufficient contrast.

### Give each object a complete identity

Record the chosen palette, type roles, spacing, geometry, controls, state
language, and motion in the slop's own design record. Define live tokens once
in root `theme.ts`; public tokens let owners change the appearance without
rebuilding the structure. Share interaction infrastructure, not a default face.

Motion should explain a change or make a control feel responsive. Keep idle
objects quiet. Persist target values immediately, respect reduced motion, and
show settled data in icon and export views. A recognizable silhouette and
strong readout should survive even when the tiny details disappear.

### Judge the working object

At its actual size, can a first-time user identify the job, read the state, and
take the next action within seconds? Does it remain usable by keyboard, with
reduced motion, and in error states? Is its memorable detail specific to its job?
Do its editor, export, and icon belong to the same object?

Review one complete pilot, fix the material issues together, and put the
working result in front of the user. Record what they approve or reject before
extending the guide or starting the next slop.

## Pick an object family

- **Paper** — the output is the object. Use editorial hierarchy, direct editing,
  normal document flow, quiet controls, and excellent PNG/PDF export.
- **Instrument** — interaction is the object. Group controls like hardware,
  prioritize one live readout or action, and make state legible at a glance.
- **Skin** — silhouette is part of the idea. Use it only when the recognizable
  object materially strengthens the task.

Hybrids are welcome. An invoice can gain a thermal-receipt skin; a tracker can
feel like a pocket instrument. Keep one dominant metaphor and one obvious job.

## Organize styles with Vanilla Extract

Use exported `style()` classes for the elements a slop owns, and import them
into Svelte with `import * as s from "./styles.css"`. Bind classes directly,
such as `class={s.startButton}`, so the component and its styles have checked
references. Keep `theme.ts` as the public token source; local class names do
not change how owners customize `stores/theme.css`.

Group one stylesheet into the surface, working area, controls, and capture
views. Keep each element's hover/focus states, Bits UI data-attribute selectors,
and media/container queries beside its base properties. Use composition for
shared structure, and split files only when real component boundaries make
that easier to maintain. Format substantial rules with readable property groups.

Reserve `globalStyle()` for document defaults and necessary descendants anchored
to a scoped class. Give Bits UI primitives local classes and use selectors such
as `&[data-state="active"]`; do not make the entire app a list of global class
selectors. Fonts, resets, and page-level reduced-motion defaults may remain global.

Focus Timer demonstrates this organization. During a refactor, preserve public
tokens, behavior, and editor/export/icon appearance, then verify the emitted
styles: composition and selector specificity can affect the cascade. The
bundled `hitslop-design` skill includes a self-contained
[`vanilla-extract.md`](../.agents/skills/hitslop-design/references/vanilla-extract.md)
reference for new projects created with `slop init`.

## Standard windows and resizing

Standard presentation takes initial dimensions, optional `resizable` (default
`true`), and `shape` (`rounded`, `ellipse`, or `capsule`).

```json
{
  "presentation": {
    "width": 640,
    "height": 480,
    "resizable": true,
    "shape": "rounded"
  }
}
```

Build from a fluid outer layout: use relative units, min/max constraints, grid
or flex reflow, and test both the manifest size and a smaller supported size.
When content changes modes, an unskinned app may request a bounded native size:

```ts
await slop.window.resize({ width: 480, height: 640 })
```

The host returns the size it could apply. The manifest remains the initial size.

## Transparent backgrounds

For a floating or non-rectangular standard window, make the page and WebView
surface transparent:

```css
html, body, #app { background: transparent; }
.object {
  background: color-mix(in srgb, #16181d 94%, transparent);
  border-radius: 32px;
  overflow: clip;
}
```

Keep interactive content inside the visible object and provide adequate
contrast. Transparency alone does not change hit testing; use a PNG skin when
you need pixel-shaped click-through behavior.

## PNG skins

A skin is an exact-size RGBA PNG under `assets/`:

```json
{
  "presentation": {
    "width": 720,
    "height": 560,
    "skin": "assets/window-mask.png"
  }
}
```

The PNG is the native backing and alpha mask. Pixels below 10% alpha are
click-through. A skinned window is fixed-size: its DOM, image, and hit-test mask
must share exact dimensions. Keep important controls away from feathered edges,
and test dragging plus pointer behavior around transparent holes.

## Capture views

Prefer optional `Export.svelte` and `Icon.svelte` presentation components wrapped
in `ExportTarget` and `IconTarget` from `@hitslop/svelte`. Pass current data and
selected view, share presentation components and theme variables, and keep
export content in normal flow. Simple slops can use the existing static CSS
fallback. The runtime owns preparation, asset readiness, and restoration.

PNG exports are 2× with explicit memory limits. PDF preserves text and vectors
on one full-length page, recomposing WebKit's internal pages when necessary.
Icons use a transparent 512px square and refresh Finder metadata on close;
immutable `QuickLook/Icon.png` stays unchanged. See [Capture views](capture.md)
for examples, preview modes, and the asynchronous preparation hook.

## Shipping checklist

Test keyboard access, visible focus, contrast, reduced motion, long text, empty
and error states, manifest dimensions, a resized standard window, static
capture, full-height PNG/PDF, and 512px icon art. The local
`hitslop-design` skill contains the same reusable design pattern for agents.


## Faster local review

Run `bun run slops:review <slug>` to review fixed-size live, narrow, export, and
icon panes together. Author-only `review.json` fixtures make empty, typical, and
long-content states repeatable without changing a new document's defaults.
The board reports readiness, dimensions, errors, and source freshness; copy its
review packet alongside browser screenshots. See the
[review workflow](../.agents/skills/hitslop-design/references/review-workbench.md).

Inspect in one batch, fix material findings, then verify the affected behavior.
Use fresh screenshots for visual changes and accessibility-tree evidence for
accessible-name changes. Build and validate after corrections; avoid unrelated
recaptures or checks. Render readiness is not a substitute for design judgment.
