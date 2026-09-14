<script lang="ts">
  import * as s from "./styles.css";

  let { tilt, proTotal, conTotal }: { tilt: number; proTotal: number; conTotal: number } = $props();
  const net = $derived(proTotal - conTotal);
  const lean = $derived(net > 0 ? "for" : net < 0 ? "against" : "even");
</script>

<div class={s.scale} aria-live="polite">
  <div class={s.beamHold} aria-hidden="true">
    <div class={s.post}></div>
    <div class={s.fulcrum}></div>
    <div class={s.beam} style:transform={`rotate(${tilt}deg)`}>
      <div class={s.bar}></div>
      <div class={s.hang} style:transform={`rotate(${-tilt}deg)`}>
        <span class={s.chain}></span>
        <div class={s.pan} data-side="for">{proTotal}</div>
      </div>
      <div class={s.hang} style:transform={`rotate(${-tilt}deg)`}>
        <span class={s.chain}></span>
        <div class={s.pan} data-side="against">{conTotal}</div>
      </div>
    </div>
  </div>
  <p class={s.delta} data-lean={lean}>
    {#if net > 0}
      For by {net}
    {:else if net < 0}
      Against by {Math.abs(net)}
    {:else}
      Even balance
    {/if}
  </p>
</div>
