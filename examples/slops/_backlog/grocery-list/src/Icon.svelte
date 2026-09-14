<script lang="ts">
  import * as s from "./styles.css";
  let { completed = 0, total = 0 }: { completed?: number; total?: number } = $props();
  const marks = $derived(total > 0 ? Math.round(4 * completed / total) : 0);
</script>

<div class={s.iconSurface} aria-hidden="true">
  <div class={s.iconPlate}>
    <div class={s.iconPad}>
      <div class={s.iconTitle}></div>
      <div class={s.iconLines}>
        {#each [0, 1, 2, 3] as index}
          <div class={s.iconRow}>
            <span class={s.iconBox} data-done={index < marks}></span>
            <i class={s.iconLine}></i>
          </div>
        {/each}
      </div>
    </div>
    <div class={s.iconBanana}></div>
    <span class={s.iconStar}>★</span>
  </div>
</div>
