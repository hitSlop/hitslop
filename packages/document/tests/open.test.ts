// Guards invalid persisted data rejection and host byte/envelope decoding.
import { describe, test, expect } from "bun:test";
import { LoroDoc, LoroMap, LoroMovableList, LoroText } from "loro-crdt";
import { defineDocument, s, schemaKey } from "../src/schema";
import { Document } from "../src/document";
import { MemoryStore } from "../src/memory";
import { HostStore, base64 } from "../src/bridge";

const schema = defineDocument({
  title: s.text(),
  tasks: s.list(s.object({ text: s.text(), done: s.boolean() })),
});

const initial = { title: "List", tasks: [] };

async function openStored(build: (data: LoroMap) => void) {
  const engine = new LoroDoc();
  build(engine.getMap("data"));
  engine.commit();
  const store = new MemoryStore();
  await store.checkpoint("0", engine.export({ mode: "snapshot" }), schemaKey(schema.descriptor));
  return Document.open(schema, store, initial);
}

describe("opening stored documents", () => {
  test("accepts a well-formed checkpoint", async () => {
    const doc = await openStored((data) => {
      data.setContainer("title", new LoroText()).update("Stored");
      const tasks = data.setContainer("tasks", new LoroMovableList());
      const row = tasks.insertContainer(0, new LoroMap());
      row.setContainer("text", new LoroText()).update("One");
      row.set("done", true);
    });
    expect(doc.current.title).toBe("Stored");
    expect(doc.current.tasks.map((t) => [t.text, t.done])).toEqual([["One", true]]);
    await doc.close();
  });
  test("rejects a text field stored as a string register", async () => {
    await expect(
      openStored((data) => {
        data.set("title", "Stored");
        data.setContainer("tasks", new LoroMovableList());
      }),
    ).rejects.toThrow("Expected LoroText");
  });
  test("rejects unknown stored fields", async () => {
    await expect(
      openStored((data) => {
        data.setContainer("title", new LoroText());
        data.setContainer("tasks", new LoroMovableList());
        data.set("extra", 1);
      }),
    ).rejects.toThrow("Unknown stored field: extra");
  });
  test("rejects invalid scalar values in rows", async () => {
    await expect(
      openStored((data) => {
        data.setContainer("title", new LoroText());
        const row = data
          .setContainer("tasks", new LoroMovableList())
          .insertContainer(0, new LoroMap());
        row.setContainer("text", new LoroText());
        row.set("done", "yes");
      }),
    ).rejects.toThrow("Expected boolean");
  });
  test("rejects missing fields", async () => {
    await expect(
      openStored((data) => {
        data.setContainer("title", new LoroText());
      }),
    ).rejects.toThrow("Expected LoroMovableList");
  });
});

describe("bridge", () => {
  test("base64 round-trips empty, odd and large payloads", () => {
    for (const size of [0, 1, 2, 3, 16_383, 16_384, 16_385, 100_001]) {
      const bytes = new Uint8Array(size).map((_, i) => (i * 31 + 7) & 255);
      const text = base64.encode(bytes);
      expect(text).toBe(Buffer.from(bytes).toString("base64"));
      expect(base64.decode(text)).toEqual(bytes);
    }
  });
  test("base64 falls back without native Uint8Array helpers", () => {
    const from = Object.getOwnPropertyDescriptor(Uint8Array, "fromBase64");
    const to = Object.getOwnPropertyDescriptor(Uint8Array.prototype, "toBase64");
    delete (Uint8Array as any).fromBase64;
    delete (Uint8Array.prototype as any).toBase64;
    try {
      const bytes = new Uint8Array(40_000).map((_, i) => (i * 13) & 255);
      const text = base64.encode(bytes);
      expect(text).toBe(Buffer.from(bytes).toString("base64"));
      expect(base64.decode(text)).toEqual(bytes);
    } finally {
      if (from) Object.defineProperty(Uint8Array, "fromBase64", from);
      if (to) Object.defineProperty(Uint8Array.prototype, "toBase64", to);
    }
  });
  test("HostStore decodes stored bytes from the host", async () => {
    const calls: unknown[] = [];
    (globalThis as any).webkit = {
      messageHandlers: {
        storage: {
          postMessage: async (args: unknown) => {
            calls.push(args);
            return {
              checkpoint: base64.encode(new Uint8Array([1, 2, 3])),
              updates: [base64.encode(new Uint8Array([4]))],
              generation: "1",
              schemaKey: "k",
            };
          },
        },
      },
    };
    try {
      const stored = await new HostStore().load();
      expect(stored.checkpoint).toEqual(new Uint8Array([1, 2, 3]));
      expect(stored.updates).toEqual([new Uint8Array([4])]);
      expect(calls).toEqual([{ method: "load" }]);
    } finally {
      delete (globalThis as any).webkit;
    }
  });
});
