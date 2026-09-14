<script lang="ts">
  import * as s from "./styles.css";
  const marks = ["•", "×", "›", "○"];
</script>

<div class={s.iconSurface} aria-hidden="true">
  <div class={s.iconPlate}>
    <span class={s.iconRibbon}></span>
    {#each marks as mark}
      <div class={s.iconRow}>
        <span class={s.iconBullet}>{mark}</span>
        <i class={s.iconLine}></i>
      </div>
    {/each}
  </div>
</div>
