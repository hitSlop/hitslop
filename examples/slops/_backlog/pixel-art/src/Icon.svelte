<script lang="ts">
  import * as s from "./styles.css";
  const FACE = new Set([8, 9, 14, 15, 16, 17, 22, 23, 25, 26, 29, 30, 33, 34, 37, 38, 41, 42, 43, 44, 45, 46, 49, 54]);
</script>

<div class={s.iconSurface} aria-hidden="true">
  <article class={s.iconBody}>
    <div class={s.iconBezel}>
      <div class={s.iconScreen}>
        {#each Array.from({ length: 64 }, (_, index) => index) as index}
          <i class={s.iconPixel} data-on={FACE.has(index)}></i>
        {/each}
      </div>
    </div>
    <div class={s.iconControls}>
      <span class={s.iconDpad}></span>
      <span class={s.iconBtns}><i class={`${s.iconBtn} ${s.iconBtnOffset}`}></i><i class={s.iconBtn}></i></span>
    </div>
  </article>
</div>
