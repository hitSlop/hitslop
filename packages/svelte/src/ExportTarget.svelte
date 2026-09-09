<script lang="ts">
  import { capture } from "@hitslop/runtime";
  import { onMount, tick, type Snippet } from "svelte";
  let { children }: { children: Snippet } = $props();
  let visible = $state(false);
  let element = $state<HTMLDivElement>();
  onMount(() => {
    
    const node = element;
    if (!node) return;
    document.body.append(node);
    const unregister = capture.registerTarget("export", {
      element: node,
      prepare: async () => { visible = true; await tick(); },
      restore: async () => { visible = false; await tick(); },
    });
    return () => { unregister(); node.remove(); };
  });
</script>
<div bind:this={element} data-slop-render="export" style:display={visible ? "block" : "none"} style:width="100%">
  {#if visible}{@render children()}{/if}
</div>
