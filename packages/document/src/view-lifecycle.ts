import type { ViewAdapter } from "./adapter";
import type { Document } from "./document";
import type { ObjectNode } from "./schema";
import type { Session, Request } from "./session";
import type { createCaptureController } from "./capture";

/** Shared visible-session lifecycle. Headless sessions never mount a view. */
export async function mountViewLifecycle<N extends ObjectNode>(options: {
  adapter: ViewAdapter<N>;
  document: Document<N>;
  target: HTMLElement;
  session: Pick<Session, "flush" | "handle" | "prepareClose" | "cancelClose" | "close">;
  capture: Pick<ReturnType<typeof createCaptureController>, "begin" | "restore">;
  recovered?: () => Promise<unknown>;
}) {
  const { adapter, document, target, session, capture, recovered } = options;
  const mount = () => adapter.mount({ document, target });
  let view = await mount();
  await view.rendered();
  return {
    reloadInterface: async () => {
      await session.flush();
      let failure: { error: unknown } | undefined;
      const failed = (event: Event) => {
        failure = { error: (event as CustomEvent).detail };
      };
      target.ownerDocument.addEventListener("hitslop:render-error", failed);
      try {
        await view.unmount();
        view = await mount();
        await view.rendered();
        if (failure) throw failure.error;
        await recovered?.();
      } finally {
        target.ownerDocument.removeEventListener("hitslop:render-error", failed);
      }
    },
    request: (request: Request) => session.handle(request),
    flush: () => session.flush(),
    prepareClose: async () => {
      await session.prepareClose();
      target.inert = true;
    },
    cancelClose: () => {
      session.cancelClose();
      target.inert = false;
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
        await view.unmount();
      } catch (error) {
        console.error(error);
      }
    },
    captureBegin: async (token: string) => {
      await session.flush();
      await view.rendered();
      return capture.begin(token, "export");
    },
    captureRestore: (token: string) => capture.restore(token),
  } satisfies import("./runtime-handle").SlopRuntimeHandle;
}
