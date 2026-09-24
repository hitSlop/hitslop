import { test, expect } from "bun:test";
import { ThemeController } from "../src/theme-runtime";
import { defineTheme } from "../src/theme";
import { Document } from "../src/document";
import { Session } from "../src/session";
import { MemoryStore } from "../src/memory";
import { defineDocument, s } from "../src/schema";

test("theme overrides persist before application and failed writes preserve the visible theme", async () => {
  const defaults = defineTheme({ accent: "red", paper: "white" });
  let persisted = {},
    visible = {},
    fail = false;
  const theme = new ThemeController(
    defaults.defaults,
    async (values) => {
      if (fail) throw new Error("disk full");
      persisted = structuredClone(values);
    },
    (values) => {
      visible = values;
    },
  );
  theme.load({});
  await theme.set({ accent: "blue" });
  expect(persisted).toEqual({ accent: "blue" });
  expect(visible).toEqual({ accent: "blue", paper: "white" });
  fail = true;
  await expect(theme.set({ accent: "green" })).rejects.toThrow("disk full");
  expect(theme.get().overrides).toEqual({ accent: "blue" });
  expect(visible).toEqual({ accent: "blue", paper: "white" });
  fail = false;
  const reopened = new ThemeController(defaults.defaults, async () => {});
  reopened.load(persisted);
  expect(reopened.get()).toEqual(theme.get());
  await theme.reset("accent");
  expect(visible).toEqual(defaults.defaults);
  await theme.set({ accent: "blue", paper: "black" });
  await theme.reset();
  expect(persisted).toEqual({});
});

test("theme rejects undeclared tokens, structural CSS and oversized values without saving", async () => {
  let saves = 0;
  const theme = new ThemeController({ accent: "red" }, async () => {
    saves++;
  });
  for (const values of [
    { missing: "blue" },
    { accent: "red;display:none" },
    { accent: "}" },
    { accent: "x".repeat(4097) },
    { accent: "var(--slop-unknown)" },
  ] as Record<string, string>[]) {
    await expect(theme.set(values)).rejects.toThrow();
  }
  await expect(theme.reset("missing")).rejects.toThrow();
  expect(saves).toBe(0);
  expect(() => defineTheme({ "invalid token": "red" })).toThrow();
});

test("theme commands serialize with document saves and reject stale sessions", async () => {
  const store = new MemoryStore();
  const doc = await Document.open(defineDocument({ title: s.text() }), store, { title: "Initial" });
  const theme = new ThemeController({ accent: "red" }, async () => {});
  const session = new Session(doc, "current", theme);
  const base = {
    id: "theme",
    documentPath: "test",
    method: "theme.set" as const,
    values: { accent: "blue" },
  };
  expect((await session.handle({ ...base, epoch: "old" })).ok).toBe(false);
  doc.fields.title.replace("Pending");
  const append = store.append.bind(store);
  store.append = async () => {
    throw new Error("disk full");
  };
  expect((await session.handle({ ...base, epoch: "current" })).ok).toBe(false);
  expect(theme.get().effective.accent).toBe("red");
  store.append = append;
  expect((await session.handle({ ...base, epoch: "current" })).ok).toBe(true);
  await session.close();
});
