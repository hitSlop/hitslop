<script lang="ts">
  import * as s from "./styles.css";
  let { packed = 0, total = 0 }: { packed?: number; total?: number } = $props();
  const marks = $derived(total > 0 ? Math.round(4 * packed / total) : 0);
  const rows = [
    { stamp: "DOCS", tone: "cobalt", length: "long" },
    { stamp: "CARRY", tone: "vermilion", length: "med" },
    { stamp: "TECH", tone: "emerald", length: "long" },
    { stamp: "TOILET", tone: "amber", length: "short" },
  ] as const;
</script>

<div class={s.iconSurface} aria-hidden="true">
  <div class={s.iconTag}>
    <div class={s.iconGrommet}>
      <div class={s.iconLoop}></div>
      <div class={s.iconEyelet}><div class={s.iconHole}></div></div>
    </div>
    <div class={s.iconAirmail}></div>
    <div class={s.iconHead}>
      <div class={s.iconFlight}>HS-AIR</div>
      <div class={s.iconDest}>HND</div>
    </div>
    <div class={s.iconChecks}>
      {#each rows as row, index}
        <div class={s.iconRow}>
          <span class={s.iconBox} data-done={index < marks}>{#if index < marks}✓{/if}</span>
          <span class={s.iconLine} data-length={row.length}></span>
          <span class={s.iconStamp} data-stamp={row.tone}>{row.stamp}</span>
        </div>
      {/each}
    </div>
    <div class={s.iconSeal}>
      <span class={s.iconSealText}>{packed > 0 && packed === total ? "PACKED" : "PACKING"}</span>
      <span class={s.iconSealSub}>{total > 0 ? `${Math.round(100 * packed / total)}% READY` : "EMPTY TAG"}</span>
    </div>
    <div class={s.iconBarcodeRow}>
      <div class={s.iconBarcode}></div>
      <span class={s.iconTagNum}>#HS-9402</span>
    </div>
  </div>
</div>
