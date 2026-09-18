<script lang="ts" generics="S extends TSchema">
  import type { TSchema } from "typebox";
  import { onMount, untrack, type Snippet } from "svelte";
  import { capture, reportRuntimeError } from "@hitslop/runtime";
  import type { SlopDocument } from "./create-document.svelte.js";
  import { documentScope } from "./document-scope.js";
  import { provideSlop } from "./slop-context.js";
  import IconTarget from "./IconTarget.svelte";
  import ExportTarget from "./ExportTarget.svelte";

  let { document, children, icon, exportView }: {
    document: SlopDocument<S>;
    children: Snippet;
    icon?: Snippet;
    exportView?: Snippet;
  } = $props();

  // One document per mounted app. Switching documents remounts the app boundary.
  const scope = untrack(() => { provideSlop(document); return documentScope(document); });
  onMount(() => {
    const stop = scope.subscribe(issue => { void reportRuntimeError(issue); });
    const unprepare = capture.onPrepare(() => {
      if (scope.renderError) throw new Error(scope.renderError);
    });
    return () => { stop(); unprepare(); scope.resetRender = undefined; };
  });
  function failed(error: unknown, reset: () => void) {
    scope.resetRender = reset;
    scope.renderError = error instanceof Error ? error.message : String(error);
    scope.report({ source: "render", message: scope.renderError });
  }
</script>

<svelte:boundary onerror={failed}>
  <div data-hitslop-root aria-busy={document.isLoading} inert={document.isLoading} style:height="100%" style:min-height="0">
    {@render children()}
  </div>
  {#if icon}<IconTarget>{@render icon()}</IconTarget>{/if}
  {#if exportView}<ExportTarget>{@render exportView()}</ExportTarget>{/if}
</svelte:boundary>
