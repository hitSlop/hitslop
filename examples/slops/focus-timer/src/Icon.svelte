<script lang="ts">
  import * as s from "./styles.css";
  import Leaf from "./Leaf.svelte";
  let { minutes = 25 }: { minutes?: number } = $props();
</script>

<div class={s.iconCanvas} aria-hidden="true">
  <article class={s.iconShell}>
    <Leaf />
    <div class={s.iconFace}><span class={s.iconDigits}>{minutes}</span><i class={s.iconTick}></i></div>
    <div class={s.iconButton}></div>
  </article>
</div>
