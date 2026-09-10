<script lang="ts">
  import * as s from "./styles.css";
  let { words = 0 }: { words?: number } = $props();
  const complete = $derived(words >= 750);
  const label = $derived(complete ? "750" : String(Math.max(0, Math.round(words))).padStart(3, "0"));
</script>

<div class={s.iconSurface} aria-hidden="true">
  <div class={s.iconPad}>
    <span class={s.iconMargin}></span>
    <div class={s.iconLines}>
      <span class={s.iconLine}></span>
      <span class={s.iconLine}></span>
      <span class={s.iconLine}></span>
      <span class={s.iconLine}></span>
      <span class={s.iconLine}></span>
    </div>
    <span class={s.iconSeal} data-complete={complete}>{label}</span>
  </div>
</div>
