<script lang="ts">
  import * as s from "./styles.css";
</script>

<div class={s.iconSurface} aria-hidden="true">
  <article class={s.iconPage}>
    <div class={s.iconGrid}>
      {#each { length: 9 } as _, index (index)}
        <span class={s.iconCell} data-role={index === 4 ? "goal" : "theme"}></span>
      {/each}
    </div>
  </article>
</div>
