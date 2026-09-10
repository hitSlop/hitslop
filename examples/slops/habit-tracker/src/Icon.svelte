<script lang="ts">
  import * as s from "./styles.css";
  let { streak = 14, rate = 88 }: { streak?: number; rate?: number } = $props();
  const cells = [1, 1, 1, 1, 0, 1, 1, 1, 1, 1, 1, 0, 1, 1, 1, 1, 1, 1, 1, 1];
</script>

<div class={s.iconSurface} aria-hidden="true">
  <article class={s.habitIcon}>
    <header class={s.iconHead}>
      <span class={s.iconLens}></span>
      <span class={s.iconLabel}>HABIT·TRACKER</span>
      <span class={s.iconSpeaker}><i></i><i></i><i></i></span>
    </header>
    <div class={s.iconScreen}>
      <div class={s.iconScreenTop}>
        <span class={s.iconBadge}>STREAK {streak}D</span>
        <span class={s.iconRate}>{rate}%</span>
      </div>
      <div class={s.iconGrid}>
        {#each cells as on, index (index)}
          <span class={s.iconCell} data-on={on === 1}></span>
        {/each}
      </div>
    </div>
    <div class={s.iconButtons}>
      <span class={s.iconBtnBig}>✓</span>
      <div class={s.iconBtnPair}>
        <span class={s.iconBtnSmall}></span>
        <span class={s.iconBtnSmall}></span>
      </div>
    </div>
  </article>
</div>
