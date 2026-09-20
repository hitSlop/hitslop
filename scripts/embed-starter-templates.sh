#!/bin/sh
set -eu
repo_root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
app=${1:?app bundle path required}
destination="$app/Contents/Resources/StarterTemplates"
mkdir -p "$destination"
staging=
cleanup() {
  if [ -n "$staging" ] && [ -d "$staging" ]; then
    chmod -R u+w "$staging"
    /bin/rm -rf "$staging"
  fi
}
trap cleanup EXIT HUP INT TERM
for pair in 'Checklist:quick-checklist' 'Expenses:small-expenses'; do
  input=${pair%%:*}
  slug=${pair#*:}
  source="$repo_root/generated/v1/templates/$input.slop"
  test -f "$source/manifest.json" || { echo "Run bun run build before building the app" >&2; exit 1; }
  test ! -e "$source/state"
  test ! -e "$source/stores"
  target="$destination/$slug.slop"
  staging=$(/usr/bin/mktemp -d "$destination/.starter.XXXXXX")
  /usr/bin/ditto "$source" "$staging/$slug.slop"
  chmod -R u+w "$staging/$slug.slop"
  if [ -d "$target" ]; then chmod -R u+w "$target"; /bin/rm -rf "$target"; fi
  /bin/mv "$staging/$slug.slop" "$target"
  chmod -R a-w "$target"
  /bin/rmdir "$staging"
  staging=
done
