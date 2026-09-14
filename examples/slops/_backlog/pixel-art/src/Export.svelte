<script lang="ts">
  import * as s from "./styles.css";
  let { pixels }: { pixels: string[] } = $props();
</script>

<article class={s.exportSheet} aria-label="Exported 16 by 16 sprite">
  <div class={s.exportBezel}>
    <div class={s.exportGrid}>
      {#each pixels as color, index (index)}
        <span class={s.cell} style:background={color || "transparent"}></span>
      {/each}
    </div>
  </div>
</article>
