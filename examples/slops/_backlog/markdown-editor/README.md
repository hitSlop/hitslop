# Markdown Editor

A tactile, zero-complexity markdown editor powered by the **OverType** architecture: a transparent native `<textarea>` layered directly over live-rendered markdown syntax and styling, with `@humanspeak/svelte-markdown` powering split-view and export preview.

- **Job**: Compose, edit, and read markdown documents with native textarea interactions, zero contentEditable bugs, and real-time WYSIWYG elegance.
- **Storage**: Canonical `stores/data.json` storing document title, markdown content, active mode, and theme.
- **Modes**:
  - `In-Place` (OverType transparent ghost textarea over rendered syntax)
  - `Split` (side-by-side editing and formatted prose)
  - `Preview` (clean reading and print-ready manuscript)
- **Visuals**: Warm typewriter paper (`#faf7f0`), dark carbon ink, safety-vermilion cursor accent, and obsidian dark mode.
