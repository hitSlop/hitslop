#!/bin/sh
set -eu

# Build, embed, and sign a Release hitslop-native in an existing .app.
# Usage: embed-hitslop-native.sh <HitSlop.app>

script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
repo_root=$(CDPATH= cd -- "$script_dir/.." && pwd)
native_package="$repo_root/apps/apple/Packages/HitSlopApple"

app=${1:-}
if [ -z "$app" ] || [ ! -d "$app" ]; then
  echo "Usage: $0 <HitSlop.app>" >&2
  exit 64
fi

scratch=${HITSLOP_NATIVE_SCRATCH:-}
if [ -z "$scratch" ]; then
  scratch=$(/usr/bin/mktemp -d "${TMPDIR:-/tmp}/hitslop-native.XXXXXX")
  trap '/bin/rm -rf "$scratch"' EXIT HUP INT TERM
fi

archs=${HITSLOP_NATIVE_ARCHS:-}
if [ -z "$archs" ]; then
  case "$(/usr/bin/uname -m)" in
    arm64) archs="arm64" ;;
    x86_64) archs="x86_64" ;;
    *) echo "Unsupported macOS architecture: $(/usr/bin/uname -m)" >&2; exit 69 ;;
  esac
fi

supported_archs=
for arch in $archs; do
  case "$arch" in
    arm64|x86_64) supported_archs="$supported_archs $arch" ;;
  esac
done

if [ -z "$supported_archs" ]; then
  echo "No supported architectures were requested: $archs" >&2
  exit 69
fi

echo "Building hitslop-native ($archs)…"
# Multiple --arch flags select SwiftPM's Xcode backend, which tries to copy
# unrelated Firebase/TCA resource bundles for this executable-only build.
# Build the product with the native backend once per architecture instead.
set --
for arch in $supported_archs; do
  /usr/bin/swift build \
    --package-path "$native_package" \
    --scratch-path "$scratch" \
    --build-system native \
    --configuration release \
    --product hitslop-native \
    --arch "$arch"
  native_bin=$(
    /usr/bin/swift build \
      --package-path "$native_package" \
      --scratch-path "$scratch" \
      --build-system native \
      --configuration release \
      --product hitslop-native \
      --show-bin-path \
      --arch "$arch"
  )
  helper="$native_bin/hitslop-native"
  if [ ! -f "$helper" ]; then
    echo "hitslop-native is missing at $helper" >&2
    exit 70
  fi
  set -- "$@" "$helper"
done

# SwiftPM executables locate Bundle.module resources beside the executable.
# The host app also links HitSlopCore and therefore has a copy in Resources,
# but that location is not visible to this independently-built helper.
/bin/mkdir -p "$app/Contents/Helpers"
if [ "$#" -eq 1 ]; then
  /bin/cp "$1" "$app/Contents/Helpers/hitslop-native"
else
  /usr/bin/lipo -create "$@" -output "$app/Contents/Helpers/hitslop-native"
fi
/bin/chmod 755 "$app/Contents/Helpers/hitslop-native"

# Xcode does not automatically sign nested content added by a run script. Use
# its resolved identity for normal builds and an ad-hoc signature when signing
# is disabled; distribution packaging replaces both signatures as needed.
signing_identity=${EXPANDED_CODE_SIGN_IDENTITY:--}
for module in HitSlopCore HitSlopRuntime; do
  resource_bundle="$native_bin/HitSlopApple_${module}.bundle"
  if [ ! -d "$resource_bundle" ]; then
    echo "hitslop-native resource bundle is missing at $resource_bundle" >&2
    exit 70
  fi
  embedded="$app/Contents/Helpers/HitSlopApple_${module}.bundle"
  /usr/bin/ditto "$resource_bundle" "$embedded"
  /bin/cp "$script_dir/HitSlopNativeResources-Info.plist" "$embedded/Info.plist"
  /usr/libexec/PlistBuddy -c "Set :CFBundleIdentifier com.hitslop.app.native-resources.$module" "$embedded/Info.plist"
  /usr/libexec/PlistBuddy -c "Set :CFBundleName $module Resources" "$embedded/Info.plist"
  /usr/bin/codesign --force --sign "$signing_identity" "$embedded"
done
/usr/bin/codesign --force --options runtime --sign "$signing_identity" "$app/Contents/Helpers/hitslop-native"
echo "Embedded $app/Contents/Helpers/hitslop-native"
