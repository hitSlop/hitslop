<script lang="ts">
  import { getContext, onMount, type Snippet } from "svelte";
  import { capture } from "./capture";
  import CaptureTarget from "./CaptureTarget.svelte";
  import { documentContext } from "./document-context";
  import type { Document } from "./document";
  import type { ObjectNode } from "./schema";

  let { children, exportView, icon }: {
    children: Snippet;
    exportView?: Snippet;
    icon?: Snippet;
  } = $props();
  const document = getContext<Document<ObjectNode>>(documentContext);
  if (!document) throw new Error("Slop requires a host document; mount the app with mountDocument");
  let renderFailure: { error: unknown } | undefined;
  function assertRenderable() { if (renderFailure) throw renderFailure.error; }
  const describe = (error: unknown) => error instanceof Error ? error.message : String(error);
  function reportRenderError(error: unknown) {
    renderFailure = { error };
    globalThis.document.dispatchEvent(new CustomEvent("hitslop:render-error", { detail: error }));
    const storage = (globalThis as any).webkit?.messageHandlers?.storage;
    void storage?.postMessage({ method: "runtimeError", kind: "application", error: (error instanceof Error ? error.stack ?? error.message : String(error)).slice(0, 4096) }).catch(() => {});
  }
  onMount(() => capture.onPrepare(async () => {
    assertRenderable();
    await document.flush();
  }));
</script>

<svelte:boundary onerror={reportRenderError}>
  <div data-hitslop-root>
    {@render children()}
  </div>
  {#snippet failed(error)}
    <p role="alert">Could not render this document: {describe(error)}</p>
  {/snippet}
</svelte:boundary>
<!-- Capture snippets fail only their capture, never the editor. -->
{#if exportView}<CaptureTarget kind="export" {assertRenderable} content={exportView} />{/if}
{#if icon}<CaptureTarget kind="icon" {assertRenderable} content={icon} />{/if}
