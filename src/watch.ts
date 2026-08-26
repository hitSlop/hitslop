import { watch } from "node:fs";
import type { Database } from "bun:sqlite";
import { getView } from "./db.ts";

export type Change = { type: "data" | "view" };

export function watchSlop(
  path: string,
  db: Database,
  onChange: (change: Change) => void,
): () => void {
  let lastView = getView(db)?.body ?? "";
  let timer: ReturnType<typeof setTimeout> | undefined;
  const fire = () => {
    const view = getView(db)?.body ?? "";
    const type: Change["type"] = view !== lastView ? "view" : "data";
    lastView = view;
    onChange({ type });
  };
  const bounce = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(fire, 60);
  };

  const watchers = [path, `${path}-wal`].map((target) => {
    try {
      return watch(target, { persistent: false }, bounce);
    } catch {
      return null;
    }
  });

  // WAL file may appear after the first write.
  let walPoll: ReturnType<typeof setInterval> | undefined;
  walPoll = setInterval(() => {
    if (watchers[1]) {
      clearInterval(walPoll);
      return;
    }
    try {
      watchers[1] = watch(`${path}-wal`, { persistent: false }, bounce);
      clearInterval(walPoll);
    } catch {
      /* not yet */
    }
  }, 400);

  return () => {
    if (timer) clearTimeout(timer);
    if (walPoll) clearInterval(walPoll);
    for (const w of watchers) w?.close();
  };
}
