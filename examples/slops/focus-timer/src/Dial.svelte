<script lang="ts">
  import * as s from "./styles.css";
  import type { Snippet } from "svelte";
  let { label, ratio = 1, kind = "focus", modes, detail }: {
    label: string;
    ratio?: number;
    kind?: "focus" | "rest";
    modes?: Snippet;
    detail?: Snippet;
  } = $props();
  const circumference = 2 * Math.PI * 103;
</script>

<div class={s.dial} data-kind={kind}>
  <svg class={s.dialGraphic} viewBox="0 0 260 260" aria-hidden="true">
    {#each Array(60) as _, index}
      <line class={index % 5 === 0 ? s.majorTick : s.dialTick} x1="130" y1="12" x2="130" y2={index % 5 === 0 ? 23 : 17} transform={`rotate(${index * 6} 130 130)`} />
    {/each}
    <circle class={s.dialTrack} cx="130" cy="130" r="103" />
    <circle class={s.dialProgress} cx="130" cy="130" r="103" transform="rotate(-90 130 130)" stroke-dasharray={circumference} stroke-dashoffset={(1 - ratio) * circumference} />
  </svg>
  <div class={s.readout}>
    {#if modes}{@render modes()}{:else}<p class={s.staticMode}>{kind === "focus" ? "Focus" : "Break"}</p>{/if}
    <output class={s.digits} role="timer" aria-live="off" aria-label={`${kind === "focus" ? "Focus" : "Break"}: ${label} remaining`}>{label}</output>
    {#if detail}{@render detail()}{/if}
  </div>
</div>
