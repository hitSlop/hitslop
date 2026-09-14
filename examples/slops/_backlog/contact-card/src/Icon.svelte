<script lang="ts">
  import * as s from "./styles.css";
  let { letter = "C" }: { letter?: string } = $props();
</script>

<div class={s.iconSurface} aria-hidden="true">
  <div class={s.iconPlate}>
    <div class={s.iconBadge}>
      <div class={s.iconNotch}></div>
      <span class={s.iconTab}>{letter}</span>
      <div class={s.iconAvatar}>{letter}</div>
      <div class={s.iconTextGroup}>
        <span class={s.iconNameBar}></span>
        <span class={s.iconSubBar}></span>
      </div>
      <div class={s.iconLines}>
        <span class={s.iconRow}></span>
        <span class={s.iconRow}></span>
        <span class={s.iconRow}></span>
      </div>
      <div class={s.iconButtons}>
        <span class={s.iconCircle}></span>
        <span class={s.iconCircle}></span>
        <span class={s.iconCircle}></span>
      </div>
    </div>
  </div>
</div>
