import { initialize, Document, Session, HostStore, hostCall, fromDescriptor, openTheme } from "./index.js";
try {
  await initialize();
  const config = await hostCall({ method: "config" });
  const descriptor = await fetch("/state.schema.json").then((r) => r.json());
  const initial = await fetch("/initial.json").then((r) => r.json());
  const doc = await Document.open(fromDescriptor(descriptor), new HostStore(), initial);
  const session = new Session(doc, config.epoch, await openTheme(true));
  globalThis.__slop = {
    request: (request) => session.handle(request),
    prepareClose: () => session.prepareClose(),
    cancelClose: () => session.cancelClose(),
    flush: () => session.flush(),
    close: () => session.close(),
    retrySave: () => session.flush(),
  };
  await hostCall({ method: "ready" });
} catch (error) {
  await hostCall({ method: "failed", error: String(error) });
}
