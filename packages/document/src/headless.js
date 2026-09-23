import { initialize, Document, Session, HostStore, hostCall, fromDescriptor, openTheme, configureAttachments } from "./index.js";
try {
  const [, config, descriptor, initial, theme] = await Promise.all([
    initialize(),
    hostCall({ method: "config" }),
    fetch("/state.schema.json").then((r) => r.json()),
    fetch("/initial.json").then((r) => r.json()),
    openTheme(true),
  ]);
  const doc = await Document.open(fromDescriptor(descriptor), new HostStore(), initial);
  const session = new Session(doc, config.epoch, theme, configureAttachments(doc, true));
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
