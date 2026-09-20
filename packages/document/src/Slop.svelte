<script lang="ts">
  import { onMount, setContext, untrack, type Snippet } from "svelte";
  import { capture } from "./capture";
  import CaptureTarget from "./CaptureTarget.svelte";
  import { slopContext, type SlopDocument } from "./slop-context";

  let { document, children, exportView, icon }: {
    document: SlopDocument;
    children: Snippet;
    exportView?: Snippet;
    icon?: Snippet;
  } = $props();
  setContext(slopContext, untrack(() => document));
  let renderError = $state<string>();
  let renderFailure: unknown;
  function assertRenderable() { if (renderFailure) throw renderFailure; }
  function reportRenderError(error: unknown) {
    renderFailure = error;
    renderError = error instanceof Error ? error.message : String(error);
    const storage = (globalThis as any).webkit?.messageHandlers?.storage;
    void storage?.postMessage({ method: "runtimeError", kind: "application", error: renderError.slice(0, 4096) }).catch(() => {});
  }
  onMount(() => capture.onPrepare(async () => {
    assertRenderable();
    await document.flush();
  }));
</script>

<svelte:boundary onerror={reportRenderError}>
  <div data-hitslop-root style:height="100%" style:min-height="0">
    {@render children()}
  </div>
  {#if exportView}<CaptureTarget kind="export" {assertRenderable}>{@render exportView()}</CaptureTarget>{/if}
  {#if icon}<CaptureTarget kind="icon" {assertRenderable}>{@render icon()}</CaptureTarget>{/if}
  {#snippet failed()}
    <p role="alert">Could not render this document: {renderError}</p>
  {/snippet}
</svelte:boundary>
