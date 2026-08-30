#!/bin/sh
set -eu

script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
repo_root=$(CDPATH= cd -- "$script_dir/.." && pwd)
project="$repo_root/apps/macos/hitSlop/hitSlop.xcodeproj"
destination=${HITSLOP_APP_DESTINATION:-/Applications/hitSlop.app}
team_id=${HITSLOP_DEVELOPMENT_TEAM:-78UAXU8QG8}
build_arch=$(/usr/bin/uname -m)
stage_dir=$(/usr/bin/mktemp -d "${TMPDIR:-/tmp}/hitslop-release.XXXXXX")
install_stage="$(dirname -- "$destination")/.hitSlop.installing.$$"
backup="$stage_dir/previous-hitSlop.app"

cleanup() {
  /bin/rm -rf "$stage_dir"
  if [ -e "$install_stage" ]; then /bin/rm -rf "$install_stage"; fi
}
trap cleanup EXIT HUP INT TERM

identity=${HITSLOP_CODESIGN_IDENTITY:-}
if [ -z "$identity" ]; then
  identity=$(/usr/bin/security find-identity -v -p codesigning \
    | /usr/bin/awk -v team="$team_id" '$0 ~ /Developer ID Application:/ && index($0, "(" team ")") { print $2; exit }')
fi
if [ -z "$identity" ]; then
  echo "No Developer ID Application identity found for team $team_id." >&2
  echo "Set HITSLOP_CODESIGN_IDENTITY to a certificate name or SHA-1 hash." >&2
  exit 69
fi
case "$build_arch" in
  arm64|x86_64) ;;
  *) echo "Unsupported macOS architecture: $build_arch" >&2; exit 69 ;;
esac

echo "Building hitSlop Release for ${build_arch}…"
/usr/bin/xcodebuild \
  -quiet \
  -project "$project" \
  -scheme hitSlop \
  -configuration Release \
  -derivedDataPath "$stage_dir/derived" \
  CODE_SIGNING_ALLOWED=NO \
  ARCHS="$build_arch" \
  ONLY_ACTIVE_ARCH=YES \
  build

app="$stage_dir/derived/Build/Products/Release/hitSlop.app"
preview="$app/Contents/PlugIns/SlopPreview.appex"
thumbnail="$app/Contents/PlugIns/SlopThumbnail.appex"

for required in "$app" "$preview" "$thumbnail"; do
  if [ ! -e "$required" ]; then
    echo "Release output is missing: $required" >&2
    exit 70
  fi
done

echo "Signing release with ${identity}…"
/usr/bin/codesign --force --timestamp --options runtime --sign "$identity" "$app/Contents/Helpers/hitslop-native"
/usr/bin/codesign --force --timestamp --options runtime --entitlements "$repo_root/apps/macos/hitSlop/Extensions/SlopExtension.entitlements" --sign "$identity" "$preview"
/usr/bin/codesign --force --timestamp --options runtime --entitlements "$repo_root/apps/macos/hitSlop/Extensions/SlopExtension.entitlements" --sign "$identity" "$thumbnail"
# Xcode's copy phase thins Sparkle after its distributed signature is made. Seal
# the copied framework again before sealing the containing application.
/usr/bin/codesign --force --timestamp --options runtime --sign "$identity" "$app/Contents/Frameworks/Sparkle.framework"
/usr/bin/codesign --force --timestamp --options runtime --entitlements "$repo_root/apps/macos/hitSlop/hitSlop/hitSlop.entitlements" --sign "$identity" "$app"
/usr/bin/codesign --verify --deep --strict --verbose=2 "$app"

echo "Installing ${destination}…"
if [ -e "$install_stage" ]; then /bin/rm -rf "$install_stage"; fi
/usr/bin/ditto "$app" "$install_stage"
if [ -e "$destination" ]; then /bin/mv "$destination" "$backup"; fi
if ! /bin/mv "$install_stage" "$destination"; then
  if [ -e "$backup" ]; then /bin/mv "$backup" "$destination"; fi
  echo "Could not replace $destination; restored the previous app." >&2
  exit 73
fi
if ! /usr/bin/codesign --verify --deep --strict --verbose=2 "$destination"; then
  /bin/rm -rf "$destination"
  if [ -e "$backup" ]; then /bin/mv "$backup" "$destination"; fi
  echo "Installed app failed verification; restored the previous app." >&2
  exit 74
fi

lsregister=/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister
for bundle_id in com.hitslop.app.preview com.hitslop.app.thumbnail; do
  /usr/bin/pluginkit -m -A -D -vv -i "$bundle_id" 2>/dev/null \
    | /usr/bin/sed -n 's/^[[:space:]]*Path = //p' \
    | while IFS= read -r path; do
        case "$path" in
          "$destination"/Contents/PlugIns/*) ;;
          *) /usr/bin/pluginkit -r "$path" >/dev/null 2>&1 || true ;;
        esac
      done
done

"$lsregister" -f "$destination"
/usr/bin/pluginkit -a "$destination/Contents/PlugIns/SlopPreview.appex"
/usr/bin/pluginkit -a "$destination/Contents/PlugIns/SlopThumbnail.appex"
/usr/bin/qlmanage -r >/dev/null 2>&1 || true
/usr/bin/qlmanage -r cache >/dev/null 2>&1 || true

# macOS can attach protected provenance metadata while registering a local app
# in /Applications. Perform the definitive local signature after registration
# so every nested signature remains valid with the installed metadata in place.
echo "Finalizing installed signatures…"
/usr/bin/codesign --force --timestamp --options runtime --sign "$identity" "$destination/Contents/Helpers/hitslop-native"
/usr/bin/codesign --force --timestamp --options runtime --entitlements "$repo_root/apps/macos/hitSlop/Extensions/SlopExtension.entitlements" --sign "$identity" "$destination/Contents/PlugIns/SlopPreview.appex"
/usr/bin/codesign --force --timestamp --options runtime --entitlements "$repo_root/apps/macos/hitSlop/Extensions/SlopExtension.entitlements" --sign "$identity" "$destination/Contents/PlugIns/SlopThumbnail.appex"
/usr/bin/codesign --force --timestamp --options runtime --sign "$identity" "$destination/Contents/Frameworks/Sparkle.framework"
/usr/bin/codesign --force --timestamp --options runtime --entitlements "$repo_root/apps/macos/hitSlop/hitSlop/hitSlop.entitlements" --sign "$identity" "$destination"
if ! /usr/bin/codesign --verify --deep --strict --verbose=2 "$destination"; then
  /bin/rm -rf "$destination"
  if [ -e "$backup" ]; then /bin/mv "$backup" "$destination"; fi
  echo "Installed app failed its final signature check; restored the previous app." >&2
  exit 75
fi

echo "Installed hitSlop $(/usr/libexec/PlistBuddy -c 'Print :CFBundleShortVersionString' "$destination/Contents/Info.plist") ($(/usr/libexec/PlistBuddy -c 'Print :CFBundleVersion' "$destination/Contents/Info.plist"))"
echo "Bundled helper: $destination/Contents/Helpers/hitslop-native"
