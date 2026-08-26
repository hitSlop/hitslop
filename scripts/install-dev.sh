#!/bin/zsh
set -euo pipefail

script_dir=${0:A:h}
repo_root=${script_dir:h}
project_dir="$repo_root/hitSlop"
installed_app="/Applications/hitSlop Prototype.app"
lsregister="/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister"
derived_root=$(/usr/bin/mktemp -d /tmp/hitslop-install.XXXXXX)
built_app="$derived_root/Build/Products/Debug/hitSlop.app"

cleanup() {
  if [[ -d "$built_app" ]]; then
    /usr/bin/pluginkit -r "$built_app/Contents/PlugIns/SlopThumbnail.appex" 2>/dev/null || true
    /usr/bin/pluginkit -r "$built_app/Contents/PlugIns/SlopPreview.appex" 2>/dev/null || true
    "$lsregister" -u "$built_app" 2>/dev/null || true
  fi
  /bin/rm -rf "$derived_root"
}
trap cleanup EXIT

/usr/bin/killall hitSlop 2>/dev/null || true
/usr/bin/killall SlopThumbnail 2>/dev/null || true
/usr/bin/killall SlopPreview 2>/dev/null || true

/usr/bin/xcodebuild \
  -project "$project_dir/hitSlop.xcodeproj" \
  -scheme hitSlop \
  -configuration Debug \
  -derivedDataPath "$derived_root" \
  test

[[ -d "$built_app" ]] || { print -u2 "Missing build product: $built_app"; exit 1; }

if [[ -e "$installed_app" ]]; then
  /bin/rm -rf "$installed_app"
fi
/usr/bin/ditto "$built_app" "$installed_app"

"$lsregister" -f -R -trusted "$installed_app"
/usr/bin/pluginkit -a "$installed_app/Contents/PlugIns/SlopThumbnail.appex"
/usr/bin/pluginkit -a "$installed_app/Contents/PlugIns/SlopPreview.appex"
/usr/bin/codesign --verify --deep --strict "$installed_app"
/usr/bin/qlmanage -r cache
/usr/bin/killall Finder 2>/dev/null || true
/usr/bin/open "$installed_app"

print "Installed $installed_app"
