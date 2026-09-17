import { chromium } from "@playwright/test";
import { writeFile } from "node:fs/promises";
const browser = await chromium.launch({ channel: "chrome" });
try {
  const page = await browser.newPage();
  await page.goto("http://127.0.0.1:5187");
  await page.waitForFunction(() => !!window.spike);
  await page.evaluate(() => window.spike!.ready());
  const results = [];
  for (const rows of [1000, 5000, 10000]) results.push(await page.evaluate(rows => window.spike!.benchmark(rows, 30), rows));
  const report = { measuredAt: new Date().toISOString(), browser: browser.version(),
    scope: "Development Vite build, zero simulated RTT. Command submission through in-memory authority, serialized snapshots, guest validation/freezing, and Svelte DOM tick. Renders a revision/count consumer, not 10,000 checklist rows; excludes browser paint, native bridge and disk durability.", results };
  await writeFile(new URL("../results/browser.json", import.meta.url), JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify(report, null, 2));
} finally { await browser.close(); }
