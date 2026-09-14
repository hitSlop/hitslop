export const documentSkillVersion = "1";
export const documentSkillPath = ".agents/skills/hitslop-document/SKILL.md";
export const documentGuidePath = ".agents/skills/hitslop-document/references/app-guide.md";
export const documentGuideSource = "document-guide.md";
export const maxDocumentGuideBytes = 32 * 1024;

export const documentSkillContent = `---
name: hitslop-document
description: Safely inspect, edit, validate, and export a built hitSlop .slop document. Use when changing its JSON data, named media, or theme overrides.
metadata:
  hitslop-skill-version: "${documentSkillVersion}"
---

# Work with this hitSlop document

Locate the target \`.slop\` directory and read its \`manifest.json\` first.
It is a built, framework-neutral web document, not a source project. All document
paths and commands below are relative to that target directory, not this skill's
installation directory. If the target contains
\`.agents/skills/hitslop-document/references/app-guide.md\`, read it for
app-specific data and styling guidance.

## Inspect

- Read \`data.schema.json\` when present before changing \`stores/data.json\`.
- Treat \`manifest.json\`, \`app.html\`, \`data.schema.json\`, \`assets/\`, this
  skill, and \`QuickLook/Icon.png\` as immutable application files.
- User data belongs in \`stores/\`. Host-owned merge history belongs in
  \`state/\`; do not edit \`state/\` by hand. \`QuickLook/Preview.png\` may be
  refreshed by the host. \`Icon\\r\` is Finder metadata, not document content.

## Edit data safely

- \`stores/data.json\` is an envelope with \`$slop\`
  and \`data\`. Preserve \`$slop\` exactly and edit only \`data\`; read the
  entire latest file before each editing pass. The host merges a saved edit
  against the revision carried by that file. Do not parse or manufacture tokens.
- Identical retries are safe. Different edits reusing an already consumed
  revision require native review. Missing/unknown metadata or invalid data is
  preserved for review; do not remove \`state/\` to force an overwrite.
- Invalid external data is retained for repair. Do not replace it with stale UI
  data. If no data exists, open the document to initialize authored defaults.
  Do not construct revision metadata or edit the host-owned state files.
- Named attachments belong in \`stores/media/\`. Names start with a lowercase
  ASCII letter and contain only lowercase letters, digits, and hyphens. Replace
  a media file atomically; use only supported image or bounded ZIP content.

## Edit the theme

The immutable defaults are in \`assets/theme.css\`. To customize appearance,
write \`stores/theme.css\` with one \`:root\` rule that overrides only existing
\`--slop-*\` variables. Do not add selectors, layout rules, or new variables.

## Check and export

Use \`slop inspect . --json\` to inspect data and guidance and \`slop open .\`
to show the document. Run \`slop validate .\` after edits. Use
\`slop export . --format png|pdf --output <path>\` for saved disk data (pending UI edits are not flushed) and
\`slop screenshot . --target preview|icon --output <path>\` for render targets.
`;

export function isCanonicalDocumentSkill(value: Uint8Array | string): boolean {
  const decoded = typeof value === "string" ? value : new TextDecoder("utf-8", { fatal: true }).decode(value);
  return decoded === documentSkillContent;
}
