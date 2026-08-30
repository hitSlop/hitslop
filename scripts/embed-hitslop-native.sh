#!/bin/sh
set -eu

# Copy a Release hitslop-native into an existing .app. Does not codesign.
# Usage: embed-hitslop-native.sh <HitSlop.app>

script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
repo_root=$(CDPATH= cd -- "$script_dir/.." && pwd)
native_package="$repo_root/apps/macos/packages/HitSlopNativeCLI"

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
    arm64) archs="arm64 x86_64" ;;
    x86_64) archs="x86_64" ;;
    *) echo "Unsupported macOS architecture: $(/usr/bin/uname -m)" >&2; exit 69 ;;
  esac
fi

arch_flags=
for arch in $archs; do
  case "$arch" in
    arm64|x86_64) arch_flags="$arch_flags --arch $arch" ;;
  esac
done

echo "Building hitslop-native ($archs)…"
# shellcheck disable=SC2086
/usr/bin/swift build \
  --package-path "$native_package" \
  --scratch-path "$scratch" \
  --configuration release \
  --product hitslop-native \
  $arch_flags

native_bin=$(
  # shellcheck disable=SC2086
  /usr/bin/swift build \
    --package-path "$native_package" \
    --scratch-path "$scratch" \
    --configuration release \
    --product hitslop-native \
    --show-bin-path \
    $arch_flags
)
helper="$native_bin/hitslop-native"
if [ ! -f "$helper" ]; then
  echo "hitslop-native is missing at $helper" >&2
  exit 70
fi

/bin/mkdir -p "$app/Contents/Helpers"
/bin/cp "$helper" "$app/Contents/Helpers/hitslop-native"
/bin/chmod 755 "$app/Contents/Helpers/hitslop-native"
echo "Embedded $app/Contents/Helpers/hitslop-native"
