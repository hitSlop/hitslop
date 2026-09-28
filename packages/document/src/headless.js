// Closed-document editing. The engine only; authored app code never loads.
try {
  const { bootHeadless } = await import("./index.js");
  await bootHeadless();
} catch (error) {
  await globalThis.webkit?.messageHandlers?.storage.postMessage({ method: "failed", error: String(error).slice(0, 4096) }).catch(() => {});
}
