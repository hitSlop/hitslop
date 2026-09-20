<script lang="ts">
  import { tick, type Snippet } from "svelte";
  import { capture } from "./capture";
  let { kind, children, assertRenderable }: { kind: "export" | "icon"; children: Snippet; assertRenderable: () => void } = $props();
  let active = $state(false);
  function register(element: HTMLDivElement) {
    // A body-level surface isolates capture from nested editor layout and clipping.
    window.document.body.append(element);
    const unregister = capture.registerTarget(kind, {
      element,
      async prepare() { active = true; await tick(); assertRenderable(); },
      async restore() { active = false; await tick(); },
    });
    return { destroy() { unregister(); element.remove(); } };
  }
</script>

<div use:register hidden={!active} data-slop-capture-target={kind}
  style:width={kind === "icon" ? "512px" : "100%"}>
  {#if active}{@render children()}{/if}
</div>
