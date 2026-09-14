import { afterEach, expect, test } from "bun:test";
import { compileModule } from "svelte/compiler";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Exercise the production rune effects: this catches a reset caused by tracking
// pause state, which a pure arithmetic test of the countdown would miss.
Bun.plugin({
  name: "focus-timer-client-runes",
  setup(build) {
    build.onResolve({ filter: /^svelte$/ }, () => ({
      path: resolve(dirname(fileURLToPath(import.meta.resolve("svelte/package.json"))), "src/index-client.js"),
    }));
    build.onLoad({ filter: /countdown\.svelte\.ts$/ }, async ({ path }) => ({
      contents: compileModule(new Bun.Transpiler({ loader: "ts" }).transformSync(await Bun.file(path).text()), { filename: path, generate: "client" }).js.code,
      loader: "js",
    }));
  },
});

const { flushSync } = await import("svelte");
const { effect_root } = await import("svelte/internal/client");
const { createCountdown } = await import("../focus-timer/src/countdown.svelte.ts");
let dispose: (() => void) | undefined;
afterEach(() => dispose?.());

function fixture(focusMinutes = 25, restMinutes = 5) {
  let time = Date.UTC(2026, 8, 10, 12);
  const sessions: Array<{ startedAt: string; kind: string; seconds: number }> = [];
  let clock!: ReturnType<typeof createCountdown>;
  dispose = effect_root(() => {
    clock = createCountdown(() => ({ focusMinutes, restMinutes }), session => sessions.push(session), () => time);
  });
  flushSync();
  return { clock, sessions, elapse(milliseconds: number) { time += milliseconds; clock.advance(); flushSync(); } };
}

test("pause preserves remaining time through rune effects and resumes the same session", () => {
  const { clock, sessions, elapse } = fixture();
  clock.start();
  flushSync();
  elapse(5250);
  clock.pause();
  flushSync();
  expect(clock.state.remaining).toBe(1495);
  expect(clock.state.status).toBe("paused");
  elapse(60_000);
  expect(clock.state.remaining).toBe(1495);
  clock.start();
  flushSync();
  elapse(750);
  expect(clock.state.remaining).toBe(1494);
  expect(sessions).toHaveLength(0);
});

test("reset and mode selection deliberately prepare a fresh session", () => {
  const { clock, elapse } = fixture();
  clock.start();
  elapse(10_000);
  clock.select("rest");
  expect(clock.state.kind).toBe("focus");
  clock.pause();
  clock.reset();
  flushSync();
  expect(clock.state.remaining).toBe(1500);
  expect(clock.state.status).toBe("ready");
  clock.select("rest");
  flushSync();
  expect(clock.state.remaining).toBe(300);
  expect(clock.state.kind).toBe("rest");
});

test("completion records once, preserves the actual start, and leaves the next mode idle", () => {
  const { clock, sessions, elapse } = fixture(1, 1);
  clock.start();
  elapse(30_000);
  clock.pause();
  flushSync();
  elapse(10_000);
  clock.start();
  elapse(31_000);
  expect(sessions).toEqual([{ startedAt: "2026-09-10T12:00:00.000Z", kind: "focus", seconds: 60 }]);
  expect(clock.state.kind).toBe("rest");
  expect(clock.state.status).toBe("complete");
  expect(clock.state.remaining).toBe(60);
  elapse(10_000);
  expect(sessions).toHaveLength(1);
  expect(clock.state.remaining).toBe(60);
  clock.start();
  clock.start();
  elapse(60_000);
  expect(sessions).toHaveLength(2);
  expect(clock.state.kind).toBe("focus");
  expect(clock.state.status).toBe("complete");
});
