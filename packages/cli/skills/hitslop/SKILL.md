---
name: hitslop
description: Create, fill, open, and export useful hitSlop documents, or build a new mini app when no template fits.
---

# Make a local hitSlop v1 document

Use `bunx @hitslop/cli`, or install with `bun install -g @hitslop/cli` and use `slop`. Installed macOS editing uses the bundled Swift hitslop-native helper without Node/Bun. Use the Mac catalog browser for templates registered under ~/.hitslop/templates. File → New from Template opens that browser. For new source read hitslop-authoring and hitslop-design. Local templates and recents work offline. Remote catalog loading, publication, and sharing are deferred.

Build with slop build SOURCE. Copy the resulting .slop template to a fresh user-selected path; never edit a master under ~/.hitslop/templates. Open the copy with the Mac app.

Read manifest.json, then slop schema DOCUMENT and slop get DOCUMENT. Apply typed operations through slop apply/batch; never edit SQLite or invent stores/data.json. Open-document CLI routes to its native owner; closed editing uses the same engine. After an uncertain mutation, run get before another edit. Never automatically replay mutations.

Use File → Export PNG/PDF or slop export DOCUMENT --format png|pdf --output FILE to deliver output. Live CLI export uses the selected view; closed export uses the default view. HITSLOP_NATIVE_CLI selects an explicit helper and never silently falls back. The export flushes drafts and persistence, waits for content, and restores the editor. Historical s-expression slop guidance is unrelated.
