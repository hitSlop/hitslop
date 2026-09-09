import { expect, test } from "bun:test";
import { JsonPersister, type JsonSnapshot } from "../src/json-persister.ts";

const snapshot = <T>(value: T): JsonSnapshot<T> => {
  const json = JSON.stringify(value);
  return { json, value: JSON.parse(json) as T };
};

const deferred = <T>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};

const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

type Scheduler = { setTimeout: (callback: () => void, delay: number) => unknown; clearTimeout: (handle: unknown) => void };
const immediateScheduler: Scheduler = {
  setTimeout: callback => setTimeout(callback, 0),
  clearTimeout: handle => clearTimeout(handle as ReturnType<typeof setTimeout>),
};
class Clock implements Scheduler {
  now = 0;
  private next = 0;
  private timers = new Map<number, { at: number; callback: () => void }>();
  setTimeout = (callback: () => void, delay: number) => {
    const id = ++this.next;
    this.timers.set(id, { at: this.now + delay, callback });
    return id;
  };
  clearTimeout = (handle: unknown) => { this.timers.delete(handle as number); };
  advance(ms: number) {
    const end = this.now + ms;
    for (;;) {
      const next = [...this.timers.entries()].filter(([, timer]) => timer.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
      if (!next) break;
      this.now = next[1].at;
      this.timers.delete(next[0]);
      next[1].callback();
    }
    this.now = end;
  }
  get size() { return this.timers.size; }
}

function harness<T>(fallback: T, initial: T = fallback, scheduler: Scheduler = immediateScheduler) {
  let stored = structuredClone(initial);
  let local = structuredClone(fallback);
  let revision = "initial";
  let writes = 0;
  const errors: Array<string | null> = [];
  const sources: string[] = [];
  const adopted: T[] = [];
  const statuses: Array<{ isDirty: boolean; isSaving: boolean }> = [];
  const io: {
    open: (initialValue: T) => Promise<{ value: T; revision: string }>;
    read: () => Promise<{ value: T; revision: string }>;
    write: (value: T, expectedRevision: string) => Promise<{ revision: string }>;
  } = {
    open: async () => ({ value: structuredClone(stored), revision }),
    read: async () => ({ value: structuredClone(stored), revision }),
    write: async (value: T) => {
      writes += 1;
      stored = structuredClone(value);
      revision = `write-${writes}`;
      return { revision };
    },
  };
  const persister = new JsonPersister<T>({
    scheduler,
    fallback: snapshot(fallback),
    io,
    getLocal: () => snapshot(local),
    onAdopt: (value, source) => { local = structuredClone(value); adopted.push(structuredClone(value)); sources.push(source); },
    onRevision: (value) => { revision = value ?? revision; },
    onSource: (source) => { sources.push(source); },
    onError: (error) => { errors.push(error?.message ?? null); },
    onStatus: status => { statuses.push(status); },
  });
  return {
    persister,
    io,
    get stored() { return stored; },
    set stored(value: T) { stored = value; },
    get local() { return local; },
    set local(value: T) { local = value; },
    get revision() { return revision; },
    set revision(value: string) { revision = value; },
    get writes() { return writes; },
    errors,
    sources,
    adopted,
    statuses,
  };
}

function edit(state: ReturnType<typeof harness<{ count: number }>>, count: number) {
  state.local = { count };
  const value = snapshot(state.local);
  state.persister.localChanged(value.json, value.value);
}

test("typing debounces for 150ms, echoes do not postpone saving, and status follows acknowledgement", async () => {
  const clock = new Clock();
  const state = harness({ count: 0 }, undefined, clock);
  await state.persister.reload();
  edit(state, 1);
  clock.advance(100);
  edit(state, 2);
  clock.advance(100);
  edit(state, 2);
  expect(state.writes).toBe(0);
  expect(state.statuses.at(-1)).toEqual({ isDirty: true, isSaving: false });
  clock.advance(50);
  await tick();
  expect(state.writes).toBe(1);
  expect(state.stored.count).toBe(2);
  expect(state.statuses).toContainEqual({ isDirty: true, isSaving: true });
  expect(state.statuses.at(-1)).toEqual({ isDirty: false, isSaving: false });
  expect(clock.size).toBe(0);
});

test("continuous edits save within one second", async () => {
  const clock = new Clock();
  const state = harness({ count: 0 }, undefined, clock);
  await state.persister.reload();
  for (let count = 1; count <= 10; count++) { edit(state, count); clock.advance(100); }
  await tick();
  expect(state.writes).toBe(1);
  expect(state.stored.count).toBe(10);
  expect(clock.size).toBe(0);
});

test("flush bypasses timers, shares the drain, and awaits edits made during a write", async () => {
  const clock = new Clock();
  const state = harness({ count: 0 }, undefined, clock);
  await state.persister.reload();
  const saving = deferred<{ revision: string }>();
  const values: number[] = [];
  state.io.write = async value => { values.push(value.count); return values.length === 1 ? saving.promise : { revision: "latest" }; };
  edit(state, 1);
  const first = state.persister.flush();
  const second = state.persister.flush();
  expect(second).toBe(first);
  await tick();
  expect(values).toEqual([1]);
  expect(clock.size).toBe(0);
  edit(state, 2);
  saving.resolve({ revision: "first" });
  await first;
  expect(values).toEqual([1, 2]);
});

test("reverting before the debounce cancels the write", async () => {
  const clock = new Clock();
  const state = harness({ count: 0 }, undefined, clock);
  await state.persister.reload();
  edit(state, 1);
  edit(state, 0);
  clock.advance(1_000);
  await state.persister.flush();
  expect(state.writes).toBe(0);
  expect(clock.size).toBe(0);
});

test("failed saves preserve the original error and identical echoes do not retry", async () => {
  const clock = new Clock();
  const state = harness({ count: 0 }, undefined, clock);
  await state.persister.reload();
  const error = Object.assign(new Error("disk full"), { code: "storage_error" });
  let attempts = 0;
  state.io.write = async () => { attempts++; throw error; };
  edit(state, 1);
  await expect(state.persister.flush()).rejects.toBe(error);
  edit(state, 1);
  clock.advance(1_000);
  await tick();
  expect(attempts).toBe(1);
  await expect(state.persister.flush()).rejects.toBe(error);
  expect(attempts).toBe(2);
});

test("invalid local data blocks older snapshots and explicit reload recovers", async () => {
  const clock = new Clock();
  const state = harness({ count: 0 }, undefined, clock);
  await state.persister.reload();
  edit(state, 1);
  const error = Object.assign(new Error("not JSON"), { code: "validation_failed" });
  state.persister.localInvalid(error);
  clock.advance(1_000);
  await expect(state.persister.flush()).rejects.toBe(error);
  expect(state.writes).toBe(0);
  expect(state.statuses.at(-1)?.isDirty).toBe(true);
  await state.persister.reload();
  expect(state.local.count).toBe(0);
  expect(state.statuses.at(-1)?.isDirty).toBe(false);
});

test("reload discards queued edits but preserves edits made during the read", async () => {
  const clock = new Clock();
  const state = harness({ count: 0 }, undefined, clock);
  await state.persister.reload();
  edit(state, 1);
  const reading = deferred<{ value: { count: number }; revision: string }>();
  state.io.read = () => reading.promise;
  const reloading = state.persister.reload();
  edit(state, 2);
  reading.resolve({ value: { count: 9 }, revision: "external" });
  await reloading;
  await state.persister.flush();
  expect(state.stored.count).toBe(2);
  expect(clock.size).toBe(0);
});

test("reload recovers when a previously running write fails after the reload request", async () => {
  const state = harness({ count: 0 });
  await state.persister.reload();
  const saving = deferred<{ revision: string }>();
  state.io.write = () => saving.promise;
  edit(state, 1);
  await tick();
  const reloading = state.persister.reload();
  saving.reject(new Error("failed old write"));
  await reloading;
  expect(state.local.count).toBe(0);
  state.stored = { count: 2 };
  state.revision = "external";
  state.persister.externalChanged("external");
  await tick();
  expect(state.local.count).toBe(2);
  expect(state.errors.at(-1)).toBeNull();
});

test("pristine init adopts the opened value and suppresses its effect echo", async () => {
  const state = harness({ count: 0 }, { count: 4 });
  await state.persister.reload();
  expect(state.local).toEqual({ count: 4 });
  const echo = snapshot(state.local);
  state.persister.localChanged(echo.json, echo.value);
  await tick();
  expect(state.writes).toBe(0);
  expect(state.sources).toEqual(["package"]);
});

test("an edit made before open resolves overwrites the opened value", async () => {
  const state = harness({ count: 0 }, { count: 9 });
  const opened = deferred<{ value: { count: number }; revision: string }>();
  state.io.open = () => opened.promise;
  const loading = state.persister.reload();
  state.local = { count: 2 };
  const changed = snapshot(state.local);
  state.persister.localChanged(changed.json, changed.value);
  opened.resolve({ value: { count: 9 }, revision: "remote" });
  await loading;
  await tick();
  expect(state.stored).toEqual({ count: 2 });
});

test("revision conflicts rebase and retry the latest local snapshot", async () => {
  const state = harness({ count: 0 }, { count: 4 });
  let attempts = 0;
  state.io.write = async (value, expected) => {
    attempts += 1;
    if (attempts === 1) {
      state.stored = { count: 8 };
      state.revision = "remote-change";
      throw Object.assign(new Error("Document changed"), { code: "revision_conflict" });
    }
    expect(expected).toBe("remote-change");
    state.stored = structuredClone(value);
    state.revision = "saved";
    return { revision: "saved" };
  };
  await state.persister.reload();
  state.local = { count: 5 };
  const changed = snapshot(state.local);
  state.persister.localChanged(changed.json, changed.value);
  await tick();
  expect(attempts).toBe(2);
  expect(state.stored).toEqual({ count: 5 });
});

test("coalesces changes during a write into one latest follow-up write", async () => {
  const state = harness({ count: 0 });
  const firstWrite = deferred<{ revision: string }>();
  const values: number[] = [];
  state.io.write = async (value) => {
    values.push(value.count);
    if (values.length === 1) return firstWrite.promise;
    state.stored = structuredClone(value);
    return { revision: "second" };
  };
  await state.persister.reload();
  state.local = { count: 1 };
  let changed = snapshot(state.local);
  state.persister.localChanged(changed.json, changed.value);
  await tick();
  state.local = { count: 2 };
  changed = snapshot(state.local);
  state.persister.localChanged(changed.json, changed.value);
  state.local = { count: 3 };
  changed = snapshot(state.local);
  state.persister.localChanged(changed.json, changed.value);
  firstWrite.resolve({ revision: "first" });
  await tick();
  expect(values).toEqual([1, 3]);
});

test("a non-conflict error halts until the next mutation and then writes the full snapshot", async () => {
  const state = harness({ count: 0, label: "a" });
  let fail = true;
  state.io.write = async (value) => {
    if (fail) { fail = false; throw new Error("bridge unavailable"); }
    state.stored = structuredClone(value);
    return { revision: "recovered" };
  };
  await state.persister.reload();
  state.local = { count: 1, label: "a" };
  let changed = snapshot(state.local);
  state.persister.localChanged(changed.json, changed.value);
  await tick();
  expect(state.errors.at(-1)).toBe("bridge unavailable");
  state.local = { count: 1, label: "b" };
  changed = snapshot(state.local);
  state.persister.localChanged(changed.json, changed.value);
  await tick();
  expect(state.stored).toEqual({ count: 1, label: "b" });
  expect(state.errors.at(-1)).toBeNull();
});

test("external changes adopt while idle and are ignored while dirty", async () => {
  const state = harness({ count: 0 });
  await state.persister.reload();
  state.stored = { count: 4 };
  state.revision = "external-1";
  state.persister.externalChanged("external-1");
  await tick();
  expect(state.local).toEqual({ count: 4 });

  state.io.write = async () => { throw new Error("offline"); };
  state.local = { count: 5 };
  const changed = snapshot(state.local);
  state.persister.localChanged(changed.json, changed.value);
  await tick();
  state.stored = { count: 7 };
  state.revision = "external-2";
  state.persister.externalChanged("external-2");
  await tick();
  expect(state.local).toEqual({ count: 5 });
});

test("an initial open failure retains edits and a later reload retries", async () => {
  const state = harness({ count: 0 });
  let attempts = 0;
  state.io.open = async () => {
    attempts += 1;
    if (attempts === 1) throw new Error("bridge unavailable");
    return { value: { count: 0 }, revision: "ready" };
  };
  state.local = { count: 1 };
  const changed = snapshot(state.local);
  state.persister.localChanged(changed.json, changed.value);
  await expect(state.persister.reload()).rejects.toThrow("bridge unavailable");
  await state.persister.reload();
  await tick();
  expect(state.stored).toEqual({ count: 1 });
  expect(state.errors.at(-1)).toBeNull();
});

test("reverting while a write is in flight persists the reverted value", async () => {
  const state = harness({ count: 0 });
  const firstWrite = deferred<{ revision: string }>();
  const values: number[] = [];
  state.io.write = async (value) => {
    values.push(value.count);
    state.stored = structuredClone(value);
    if (values.length === 1) return firstWrite.promise;
    return { revision: "reverted" };
  };
  await state.persister.reload();
  state.local = { count: 1 };
  let changed = snapshot(state.local);
  state.persister.localChanged(changed.json, changed.value);
  await tick();
  state.local = { count: 0 };
  changed = snapshot(state.local);
  state.persister.localChanged(changed.json, changed.value);
  firstWrite.resolve({ revision: "first" });
  await tick();
  expect(values).toEqual([1, 0]);
  expect(state.stored).toEqual({ count: 0 });
});

test("a failed dirty snapshot survives external events", async () => {
  const state = harness({ count: 0 });
  await state.persister.reload();
  state.io.write = async () => { throw new Error("offline"); };
  state.local = { count: 3 };
  const changed = snapshot(state.local);
  state.persister.localChanged(changed.json, changed.value);
  await tick();
  state.stored = { count: 9 };
  state.revision = "external";
  state.persister.externalChanged("external");
  await tick();
  expect(state.local).toEqual({ count: 3 });
  expect(state.errors.at(-1)).toBe("offline");
});

test("explicit reload discards a failed local snapshot and adopts disk", async () => {
  const state = harness({ count: 0 });
  await state.persister.reload();
  state.io.write = async () => { throw new Error("offline"); };
  state.local = { count: 3 };
  const changed = snapshot(state.local);
  state.persister.localChanged(changed.json, changed.value);
  await tick();

  state.stored = { count: 8 };
  state.revision = "external";
  await state.persister.reload();
  await tick();
  expect(state.local).toEqual({ count: 8 });
  expect(state.stored).toEqual({ count: 8 });
  expect(state.errors.at(-1)).toBeNull();
});

test("an external read does not adopt after a local change arrives", async () => {
  const state = harness({ count: 0 });
  await state.persister.reload();
  const reading = deferred<{ value: { count: number }; revision: string }>();
  state.io.read = () => reading.promise;
  state.persister.externalChanged("external");
  await tick();

  state.local = { count: 2 };
  const changed = snapshot(state.local);
  state.persister.localChanged(changed.json, changed.value);
  reading.resolve({ value: { count: 9 }, revision: "external" });
  await tick();
  expect(state.local).toEqual({ count: 2 });
  expect(state.stored).toEqual({ count: 2 });
});

test("flush waits for the last snapshot and bounds repeated conflicts", async () => {
  const state = harness({ count: 0 });
  await state.persister.reload();
  let attempts = 0;
  state.io.write = async () => {
    attempts += 1;
    throw Object.assign(new Error("Document changed again"), { code: "revision_conflict" });
  };
  state.local = { count: 7 };
  const changed = snapshot(state.local);
  state.persister.localChanged(changed.json, changed.value);
  await expect(state.persister.flush()).rejects.toThrow("changed again");
  expect(attempts).toBe(2);
  expect(state.local).toEqual({ count: 7 });
  state.io.write = async value => { state.stored = value; return { revision: "saved" }; };
  await state.persister.flush();
  expect(state.stored).toEqual({ count: 7 });
});
