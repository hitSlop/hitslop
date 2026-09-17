import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e", fullyParallel: false, workers: 1, timeout: 30000,
  use: { baseURL: "http://127.0.0.1:5187", viewport: { width: 1440, height: 1100 }, channel: "chrome", trace: "retain-on-failure" },
  webServer: { command: "bun run dev", url: "http://127.0.0.1:5187", reuseExistingServer: true, timeout: 60000 },
});
