<script lang="ts">
  import { capture } from "@hitslop/runtime";
  import { onMount, tick, type Snippet } from "svelte";
  let { children }: { children: Snippet } = $props();
  let visible = $state(false);
  let element = $state<HTMLDivElement>();
  onMount(() => {
    if (!capture.isRenderer()) return;
    const node = element;
    if (!node) return;
    document.body.append(node);
    const unregister = capture.registerTarget("icon", {
      element: node,
      prepare: async () => { visible = true; await tick(); },
      restore: async () => { visible = false; await tick(); },
    });
    return () => { unregister(); node.remove(); };
  });
</script>
{#if capture.isRenderer()}
<div bind:this={element} data-slop-render="icon" style:display={visible ? "block" : "none"} style:width="512px" style:height="512px" style:background="transparent">
  {#if visible}{@render children()}{/if}
</div>
{/if}
