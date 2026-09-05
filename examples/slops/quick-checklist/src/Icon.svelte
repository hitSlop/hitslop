<script lang="ts">
  import Check from "@lucide/svelte/icons/check";
  import { iconTile, iconPaper } from "./styles.css";
  let { completed = 0, total = 0 }: { completed?: number; total?: number } = $props();
  const marks = $derived(total > 0 ? Math.round(3 * completed / total) : 0);
</script>
<div style="width:512px;height:512px;display:grid;place-items:center" aria-hidden="true">
  <div class={iconTile}><div class={iconPaper}>
    {#each [0, 1, 2] as index}
      <div data-complete={index < marks}><span>{#if index < marks}<Check size={32} strokeWidth={3} />{/if}</span><i></i></div>
    {/each}
  </div></div>
</div>
