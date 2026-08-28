#!/bin/sh
set -eu

usage() {
  echo "usage: scripts/install-cli.sh --prefix <directory>" >&2
  exit 64
}

prefix=""
while [ "$#" -gt 0 ]; do
  case "$1" in
    --prefix)
      [ "$#" -ge 2 ] || usage
      prefix=$2
      shift 2
      ;;
    *) usage ;;
  esac
done

[ -n "$prefix" ] || usage
case "$prefix" in
  /|.|..) echo "refusing unsafe install prefix: $prefix" >&2; exit 64 ;;
esac

script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
repo_root=$(CDPATH= cd -- "$script_dir/.." && pwd)
bin_dir="$prefix/bin"
libexec_dir="$prefix/libexec/hitslop"
stage_dir=$(/usr/bin/mktemp -d "${TMPDIR:-/tmp}/hitslop-install.XXXXXX")
trap 'rm -rf "$stage_dir"' EXIT HUP INT TERM

command -v node >/dev/null 2>&1 || {
  echo "Node 20.19 or newer is required." >&2
  exit 69
}
command -v npm >/dev/null 2>&1 || {
  echo "npm is required to install the hitSlop web SDK." >&2
  exit 69
}
node -e 'const [major, minor] = process.versions.node.split(".").map(Number); if (major < 20 || (major === 20 && minor < 19)) process.exit(1)' || {
  echo "Node 20.19 or newer is required." >&2
  exit 69
}

swift build -c release --package-path "$repo_root/Packages/SlopCLI"
(cd "$repo_root/sdk" && npm ci)

/bin/mkdir -p "$stage_dir/sdk" "$bin_dir" "$libexec_dir"
/bin/cp "$repo_root/Packages/SlopCLI/.build/release/slop" "$stage_dir/slop"
/bin/cp -R "$repo_root/sdk/." "$stage_dir/sdk"

/bin/rm -rf "$libexec_dir/sdk"
/bin/mv "$stage_dir/sdk" "$libexec_dir/sdk"
/bin/cp "$stage_dir/slop" "$bin_dir/slop"
/bin/chmod 755 "$bin_dir/slop"

echo "installed $bin_dir/slop"
echo "installed $libexec_dir/sdk"
