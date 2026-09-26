import { Config } from "@remotion/cli/config";

// Reuse Playwright's cached headless shell instead of downloading one.
Config.setBrowserExecutable(
  process.env.REMOTION_BROWSER ??
    `${process.env.HOME}/Library/Caches/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-mac-arm64/chrome-headless-shell`,
);
