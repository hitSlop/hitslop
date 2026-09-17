import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Commands up. Snapshots down." })).toBeVisible();
  await page.evaluate(() => window.spike!.ready());
});

test("checklist commands, reorder, remove/undo, file/undo and restore work in both views", async ({ page }) => {
  const a = page.getByRole("region", { name: "Client A", exact: true });
  const b = page.getByRole("region", { name: "Client B", exact: true });
  await a.getByRole("textbox", { name: "New task", exact: true }).fill("Ship the spike");
  await a.getByRole("button", { name: "Add task", exact: true }).click();
  await expect(b.getByRole("textbox", { name: "Task 4", exact: true })).toHaveValue("Ship the spike");
  await a.getByRole("button", { name: "Actions for Ship the spike", exact: true }).click();
  await page.getByRole("menuitem", { name: "Move up" }).click();
  await expect(b.getByRole("textbox", { name: "Task 3", exact: true })).toHaveValue("Ship the spike");
  await a.getByRole("button", { name: "Actions for Ship the spike", exact: true }).click();
  await page.getByRole("menuitem", { name: "Remove task" }).click();
  await a.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(b.getByRole("textbox", { name: "Task 3", exact: true })).toHaveValue("Ship the spike");
  await a.getByRole("checkbox", { name: "Mark Ship the spike complete", exact: true }).click();
  await a.getByRole("button", { name: /File finished/ }).click();
  await expect(b.getByRole("textbox", { name: "Task 1", exact: true })).toHaveValue("Take a walk without my phone");
  await a.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(b.getByRole("textbox", { name: "Task 1", exact: true })).toHaveValue("Send the first draft");
  await a.getByRole("button", { name: /File finished/ }).click();
  await a.getByRole("tab", { name: /Filed/ }).click();
  await a.getByRole("button", { name: "Restore Ship the spike", exact: true }).click();
  await expect(b.getByRole("textbox", { name: "Task 2", exact: true })).toHaveValue("Ship the spike");
  await expect(b.getByRole("checkbox", { name: "Mark Ship the spike complete", exact: true })).not.toBeChecked();
});

test("rejection preserves composer; lost ack resolves insertion without duplicate or premature success", async ({ page }) => {
  const a = page.getByRole("region", { name: "Client A", exact: true });
  await a.getByRole("button", { name: "Reject next", exact: true }).click();
  const composer = a.getByRole("textbox", { name: "New task", exact: true });
  await composer.fill("Keep this draft");
  await a.getByRole("button", { name: "Add task", exact: true }).click();
  await expect(a.getByRole("alert")).toContainText("Injected rejection");
  await expect(composer).toHaveValue("Keep this draft");
  await a.getByRole("button", { name: "Dismiss error", exact: true }).click();
  await a.getByRole("button", { name: "Lose next ack", exact: true }).click();
  await a.getByRole("button", { name: "Add task", exact: true }).click();
  await expect(a.getByRole("alert")).toContainText("Acknowledgement lost");
  await expect(composer).toHaveValue("Keep this draft");
  await a.getByRole("button", { name: "Resolve request", exact: true }).click();
  await expect(composer).toHaveValue("");
  expect(await page.evaluate(() => window.spike!.demo.clients[0]!.store.data.tasks.filter(t => t.text === "Keep this draft").length)).toBe(1);
});

test("offline view is read only, reconnect catches up, and independent increments survive", async ({ page }) => {
  const a = page.getByRole("region", { name: "Client A", exact: true });
  const b = page.getByRole("region", { name: "Client B", exact: true });
  await a.getByRole("button", { name: "Disconnect", exact: true }).click();
  await expect(a.getByRole("textbox", { name: "New task", exact: true })).toBeDisabled();
  await b.getByRole("textbox", { name: "Checklist title", exact: true }).fill("Changed remotely");
  await b.getByRole("button", { name: "Flush drafts", exact: true }).click();
  await expect(a.getByRole("textbox", { name: "Checklist title", exact: true })).toHaveValue("Little things, today");
  await a.getByRole("button", { name: "Reconnect", exact: true }).click();
  await expect(a.getByRole("textbox", { name: "Checklist title", exact: true })).toHaveValue("Changed remotely");
  await page.getByRole("tab", { name: "150 ms", exact: true }).click();
  await a.getByRole("button", { name: "Increment", exact: true }).click();
  await b.getByRole("button", { name: "Increment", exact: true }).click();
  await expect(a.locator("output")).toHaveText("2"); await expect(b.locator("output")).toHaveText("2");
});

test("focused draft survives remote snapshot and is retained after remote deletion", async ({ page }) => {
  const a = page.getByRole("region", { name: "Client A", exact: true });
  const title = a.getByRole("textbox", { name: "Checklist title", exact: true });
  await title.focus();
  await title.dispatchEvent("compositionstart"); await title.fill("My unfinished title");
  await page.evaluate(() => window.spike!.remote([{ op: "set", path: [{ key: "title" }], value: "Remote title" }]));
  await expect(title).toHaveValue("My unfinished title");
  await title.dispatchEvent("compositionend");
  await a.getByRole("button", { name: "Flush drafts", exact: true }).click();
  await expect(page.getByRole("region", { name: "Client B", exact: true }).getByRole("textbox", { name: "Checklist title", exact: true })).toHaveValue("My unfinished title");
  const text = a.getByRole("textbox", { name: "Task 1", exact: true });
  await text.focus(); await text.dispatchEvent("compositionstart"); await text.fill("Retain this on deletion");
  await page.evaluate(() => window.spike!.remote([{ op: "remove", path: [{ key: "tasks" }], id: "first-draft" }]));
  await expect(a.getByText("Retain this on deletion", { exact: true })).toBeVisible();
  await expect(a.getByText("Unsaved text retained", { exact: true })).toBeVisible();
  await a.getByRole("button", { name: "Discard draft", exact: true }).click();
  await expect(a.getByText("Unsaved text retained", { exact: true })).toHaveCount(0);
});

test("desktop/mobile render without errors or horizontal overflow", async ({ page }) => {
  const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
  const checkFooters = async () => {
    for (const name of ["Client A", "Client B"]) {
      const client = page.getByRole("region", { name, exact: true });
      const footer = await client.getByRole("button", { name: /File finished/ }).boundingBox();
      const header = await client.getByRole("textbox", { name: "Checklist title", exact: true }).boundingBox();
      const disconnect = await client.getByRole("button", { name: "Disconnect", exact: true }).boundingBox();
      expect(footer).not.toBeNull(); expect(header).not.toBeNull(); expect(disconnect).not.toBeNull();
      expect(footer!.y).toBeGreaterThan(header!.y);
      expect(footer!.y + footer!.height).toBeLessThan(disconnect!.y);
    }
  };
  await checkFooters();
  const selected = page.getByRole("tab", { name: "0 ms", exact: true });
  const selectedColors = await selected.evaluate(node => [getComputedStyle(node).color, getComputedStyle(node).backgroundColor]);
  await selected.hover();
  expect(await selected.evaluate(node => [getComputedStyle(node).color, getComputedStyle(node).backgroundColor])).toEqual(selectedColors);
  await page.screenshot({ path: ".impeccable/review/desktop.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole("region", { name: "Client A", exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await checkFooters();
  // Rasterize both nested scrollers in the full-page capture; assertions above
  // still run at the real 390x844 mobile viewport.
  await page.setViewportSize({ width: 390, height: await page.evaluate(() => document.documentElement.scrollHeight) });
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await page.screenshot({ path: ".impeccable/review/mobile.png", fullPage: true });
  expect(errors).toEqual([]);
});
