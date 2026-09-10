<script lang="ts">
  import { drawPetIcon } from "./icon-draw";
  import * as s from "./styles.css";
  let { image }: { image: HTMLImageElement | null } = $props();
  let canvas = $state<HTMLCanvasElement>();
  $effect(() => {
    if (canvas && image) drawPetIcon(canvas, image);
  });
</script>
<div class={s.iconSurface} aria-hidden="true">
  <canvas bind:this={canvas} class={s.iconCanvas} width="512" height="512"></canvas>
</div>
