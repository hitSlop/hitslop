export const documentSkillVersion = "1";
export const documentSkillPath = ".agents/skills/hitslop-document/SKILL.md";
export const documentGuidePath = ".agents/skills/hitslop-document/references/app-guide.md";
export const documentGuideSource = "document-guide.md";
export const maxDocumentGuideBytes = 32 * 1024;

export const documentSkillContent = `---
name: hitslop-document
description: Safely inspect, edit, validate, and export a built hitSlop .slop document. Use when changing its JSON data, document attachments, or theme overrides.
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
- User-editable data belongs in \`stores/\`; \`state/\` is private host bookkeeping. \`QuickLook/Preview.png\` may be
  refreshed by the host. \`Icon\\r\` is Finder metadata, not document content.

## Edit data safely

- For JSON, preserve the exact \`$slop\` envelope and its \`baseRevision\`; edit only
  \`data\`. Validate against packaged \`data.schema.json\`, write a temporary sibling,
  then atomically replace \`stores/data.json\`. Do not invent a revision or edit
  \`state/document.sqlite\`. Re-read the file after the host accepts the change
  before starting another edit. Invalid external bytes remain for review.
- Attachments are immutable supported image or bounded ZIP files in
  \`stores/media/<sha256>\`. Compute the SHA-256 of the exact bytes, atomically
  add the digest-named file, and conditionally update its \`S.Media()\` field in
  JSON with \`{ sha256, mime, bytes, filename? }\`. Do not overwrite a digest file.
  Removing the JSON reference does not delete stored bytes. Shared media is public
  to anyone holding the hash.

## Edit the theme

The immutable defaults are in \`assets/theme.css\`. To customize appearance,
write \`stores/theme.css\` with one \`:root\` rule that overrides only existing
\`--slop-*\` variables. Do not add selectors, layout rules, or new variables.

## Check and export

Run \`slop validate .\` after edits. Use
\`slop export . --format png|pdf --output <path>\` for the full document and
\`slop screenshot . --target preview|icon --output <path>\` for render targets.
`;

export function isCanonicalDocumentSkill(value: Uint8Array | string): boolean {
  const decoded =
    typeof value === "string" ? value : new TextDecoder("utf-8", { fatal: true }).decode(value);
  return decoded === documentSkillContent;
}
