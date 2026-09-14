<script lang="ts">
  import * as s from "./styles.css";
  let { initials = "AQ" }: { initials?: string } = $props();
</script>
<div class={s.iconSurface} aria-hidden="true">
  <article class={s.iconSheet}>
    <div class={s.iconRail}></div>
    <div class={s.iconMonogram}>{initials}</div>
  </article>
</div>
