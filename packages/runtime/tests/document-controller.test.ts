import { expect, test } from "bun:test";
import * as S from "@hitslop/schema/document";
import { installHost, type DocumentFrame, type SlopHost } from "../src/index.ts";
import { createDocumentController } from "../src/document-controller.ts";
const schema = S.Document({ text: S.Text(), count: S.Integer() });
const initial = { text: "", count: 0 };
function fixture() {
  let frame: DocumentFrame = {
    publication: 0,
    revision: "r0",
    data: initial,
    dirty: false,
    error: null,
    projectionError: null,
  };
  let listener: ((value: DocumentFrame) => void) | undefined;
  const requests: unknown[] = [];
  const document = {
    open: async () => frame,
    flush: async () => frame,
    releaseDraft: async () => frame,
    onChange: (fn: (value: DocumentFrame) => void) => {
      listener = fn;
      return () => {
        listener = undefined;
      };
    },
    apply: async (request: { after: unknown }) => {
      requests.push(request);
      frame = {
        ...frame,
        publication: frame.publication + 1,
        revision: `r${frame.publication + 1}`,
        data: request.after as DocumentFrame["data"],
      };
      return frame;
    },
  };
  const uninstall = installHost({ document } as unknown as SlopHost);
  return { document, requests, uninstall, push: (next: DocumentFrame) => listener?.(next) };
}
test("queued edits use latest confirmed data and teardown drains visible drafts", async () => {
  const host = fixture();
  try {
    const store = createDocumentController({ schema, initial });
    await store.flush();
    await Promise.all([
      store.change((d) => {
        d.count++;
      }),
      store.change((d) => {
        d.count++;
      }),
    ]);
    expect(store.current.count).toBe(2);
    let flushed = false;
    store.registerDraft(() => {
      if (!flushed) {
        flushed = true;
        void store.change((d) => {
          d.text = "composition";
        });
      }
    });
    await store.destroy();
    expect(store.current.text).toBe("composition");
    expect(host.requests).toHaveLength(3);
  } finally {
    host.uninstall();
  }
});
test("invalid incoming data is not adopted and stale publication cannot roll back state", async () => {
  const host = fixture();
  try {
    const store = createDocumentController({ schema, initial });
    await store.flush();
    await store.change((d) => {
      d.count = 3;
    });
    host.push({
      publication: 10,
      revision: "bad",
      data: { count: "invalid" },
      dirty: false,
      error: null,
      projectionError: null,
    });
    expect(store.current.count).toBe(3);
    expect(store.error).not.toBeNull();
    await store.reload();
    host.push({
      publication: 0,
      revision: "r0",
      data: initial,
      dirty: false,
      error: null,
      projectionError: null,
    });
    expect(store.current.count).toBe(3);
    await store.destroy();
  } finally {
    host.uninstall();
  }
});
test("failed edits stay rejected until explicit discard; retrying close preserves the owner", async () => {
  const host = fixture();
  try {
    const store = createDocumentController({ schema, initial });
    await store.flush();
    host.document.apply = async () => {
      throw new Error("disk full");
    };
    await expect(
      store.change((d) => {
        d.count = 9;
      }),
    ).rejects.toThrow("disk full");
    await expect(store.destroy()).rejects.toThrow("disk full");
    await store.discardFailedChanges();
    expect(store.current.count).toBe(0);
    await store.destroy();
  } finally {
    host.uninstall();
  }
});

test("invalid authored edits block the barrier and never reach the host", async () => {
  const host = fixture();
  try {
    const store = createDocumentController({ schema, initial });
    await store.flush();
    await expect(
      store.change((data) => {
        data.count = "invalid" as unknown as number;
      }),
    ).rejects.toThrow();
    expect(host.requests).toHaveLength(0);
    await expect(store.flush()).rejects.toThrow();
    await store.discardFailedChanges();
    await store.destroy();
  } finally {
    host.uninstall();
  }
});

test("admission rejection does not consume the next sequence after explicit recovery", async () => {
  const { SlopError } = await import("../src/errors.ts");
  const host = fixture();
  try {
    const store = createDocumentController({ schema, initial });
    await store.flush();
    const apply = host.document.apply;
    host.document.apply = async () => {
      throw new SlopError("limit_exceeded", "Too many requests");
    };
    await expect(
      store.change((data) => {
        data.count = 4;
      }),
    ).rejects.toThrow("Too many requests");
    expect(store.hasFailedChanges).toBe(true);
    await store.discardFailedChanges();
    host.document.apply = apply;
    await store.change((data) => {
      data.count = 2;
    });
    expect(host.requests[0]).toMatchObject({ sequence: 1 });
    expect(store.current.count).toBe(2);
    await store.destroy();
  } finally {
    host.uninstall();
  }
});

test("admitted validation failure keeps its sequence consumed after explicit recovery", async () => {
  const { SlopError } = await import("../src/errors.ts");
  const host = fixture();
  try {
    const store = createDocumentController({ schema, initial });
    await store.flush();
    const apply = host.document.apply;
    host.document.apply = async () => {
      throw new SlopError("validation_failed", "JSON exceeds 1 MiB");
    };
    await expect(
      store.change((data) => {
        data.count = 4;
      }),
    ).rejects.toThrow("JSON exceeds 1 MiB");
    expect(store.hasFailedChanges).toBe(true);
    await store.discardFailedChanges();
    host.document.apply = apply;
    await store.change((data) => {
      data.count = 2;
    });
    expect(host.requests[0]).toMatchObject({ sequence: 2 });
    await store.destroy();
  } finally {
    host.uninstall();
  }
});
