<script lang="ts">
  import * as s from "./styles.css";
  let { alert = false }: { alert?: boolean } = $props();
</script>

<div class={s.iconSurface} aria-hidden="true">
  <article class={s.iconTile}>
    <div class={s.iconDeck}>
      <span class={s.iconSlot}></span>
      <span class={`${s.iconSlot} ${s.iconSlotLive}`} data-alert={alert}></span>
      <span class={s.iconSlot}></span>
    </div>
  </article>
</div>
