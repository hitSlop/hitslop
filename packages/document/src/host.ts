import { mount, unmount, tick, type Component } from "svelte";
import { documentContext } from "./document-context";
import { fromDescriptor } from "./schema";
/** App code mounts the view. The host owns the document implementation. */
export async function mountDocument(App: Component) {
  const native = Boolean((globalThis as any).webkit?.messageHandlers?.storage);
  try {
    const url = new URL("/__runtime__/index.js", location.href).href;
    // Start WASM as soon as its module loads, while the descriptor and initial
    // values are still being read. Every rejection is observed by Promise.all.
    const [{ runtime, config, theme }, descriptor, initial] = await Promise.all([
      (async () => {
        const runtime: typeof import("./runtime-entry") = await import(url);
        performance.mark("hitslop:runtime-imported");
        if (runtime.runtimeVersion !== "hitslop-v1")
          throw new Error("Installed document runtime mismatch");
        const [, config, theme] = await Promise.all([
          runtime.initialize(),
          native ? runtime.hostCall({ method: "config" }) : { epoch: crypto.randomUUID() },
          runtime.openTheme(native),
        ]);
        return { runtime, config, theme };
      })(),
      fetch("/state.schema.json").then((r) => {
        if (!r.ok) throw new Error("Missing document descriptor");
        return r.json();
      }),
      fetch("/initial.json").then((r) => {
        if (!r.ok) throw new Error("Missing initial values");
        return r.json();
      }),
    ]);
    // The disposable preview derives the stage from the manifest, as the native host does.
    if (!native) {
      const manifest = await fetch("/manifest.json").then((r) => (r.ok ? r.json() : undefined));
      if (manifest?.presentation) config.presentation = runtime.presentationStage(manifest.presentation);
    }
    if (native)
      (globalThis as any).slop = Object.freeze({
        window: {
          resize: (size: { width: number; height: number }) =>
            runtime.hostCall({ method: "window.resize", ...size }),
        },
      });
    performance.mark("hitslop:prepared");
    if (config.presentation) runtime.installPresentationStage(config.presentation);
    // Open state only after every prerequisite succeeds.
    const doc = await runtime.Document.open(
      fromDescriptor(descriptor),
      native ? new runtime.HostStore() : new runtime.MemoryStore(),
      initial,
    );
    performance.mark("hitslop:document-open");
    const attachments = runtime.configureAttachments(doc, native);
    const session = new runtime.Session(doc, config.epoch, theme, attachments);
    let app = mount(App, { target: document.body, context: new Map([[documentContext, doc]]) });
    await tick();
    performance.mark("hitslop:mounted");
    const capture = runtime.captureController();
    (globalThis as any).__slop = {
      reloadInterface: async () => {
        await session.flush();
        let failure: { error: unknown } | undefined;
        const failed = (event: Event) => {
          failure = { error: (event as CustomEvent).detail };
        };
        document.addEventListener("hitslop:render-error", failed);
        try {
          await unmount(app);
          app = mount(App, { target: document.body, context: new Map([[documentContext, doc]]) });
          await tick();
          if (failure) throw failure.error;
          if (native) await runtime.hostCall({ method: "runtimeRecovered" });
        } finally {
          document.removeEventListener("hitslop:render-error", failed);
        }
      },
      request: (request: any) => session.handle(request),
      flush: () => session.flush(),
      prepareClose: async () => {
        await session.prepareClose();
        document.body.inert = true;
      },
      cancelClose: () => {
        session.cancelClose();
        document.body.inert = false;
      },
      retrySave: async () => {
        try {
          await session.flush();
          return true;
        } catch {
          return false;
        }
      },
      close: async () => {
        await session.close();
        try {
          await unmount(app);
        } catch (error) {
          console.error(error);
        }
      },
      captureBegin: async (token: string) => {
        await session.flush();
        await tick();
        return capture.begin(token, "export");
      },
      captureRestore: (token: string) => capture.restore(token),
    };
    if (native) {
      doc.subscribe(() => {
        void runtime
          .hostCall({ method: "status", status: doc.status, error: doc.error })
          .catch(() => {});
      });
      await runtime.hostCall({ method: "ready" });
    }
  } catch (error) {
    document.body.textContent = `Could not open this document: ${String(error)}`;
    if (native)
      await (globalThis as any).webkit.messageHandlers.storage
        .postMessage({ method: "failed", error: String(error) })
        .catch(() => {});
    throw error;
  }
}
