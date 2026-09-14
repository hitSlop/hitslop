<script lang="ts">
  import type { Decision } from "../schema";
  import { clampWeight } from "./balance";
  import { STATUSES } from "./statuses";
  import Scale from "./Scale.svelte";
  import * as s from "./styles.css";

  let { data, tilt, proTotal, conTotal }: { data: Decision; tilt: number; proTotal: number; conTotal: number } = $props();
  const statusLabel = $derived(STATUSES.find(item => item.value === data.status)?.label ?? data.status ?? "Evaluating");
</script>

<article class={s.exportLetter} aria-label="Exported decision balance">
  <header class={s.letterhead}>
    <div class={s.metaRow}>
      <span class={s.stamp}>Decision Balance</span>
      <span class={s.dateField}>{data.date}</span>
    </div>
    <div class={s.questionRow}>
      <span class={s.whether}>Whether to</span>
      <h1 class={s.question}>{data.question.trim() || "state the choice clearly…"}</h1>
    </div>
    <Scale {tilt} {proTotal} {conTotal} />
  </header>

  <div class={s.spread}>
    <section class={s.column} data-side="for" aria-labelledby="export-for">
      <div class={s.columnHead}>
        <div>
          <h2 id="export-for" class={s.columnTitle}>Pros</h2>
          <span class={s.columnHint}>Reasons in favor</span>
        </div>
        <span class={s.columnTotal}>{proTotal}</span>
      </div>
      <ul class={s.list}>
        {#each data.pros as item (item.id)}
          <li class={s.row}>
            <span class={s.reason}>{item.text.trim() || "Untitled reason"}</span>
            <span class={s.weightNum}>{clampWeight(item.weight)}</span>
          </li>
        {:else}
          <li class={s.empty}>No motives recorded.</li>
        {/each}
      </ul>
    </section>
    <section class={s.column} data-side="against" aria-labelledby="export-against">
      <div class={s.columnHead}>
        <div>
          <h2 id="export-against" class={s.columnTitle}>Cons</h2>
          <span class={s.columnHint}>Reasons against</span>
        </div>
        <span class={s.columnTotal}>{conTotal}</span>
      </div>
      <ul class={s.list}>
        {#each data.cons as item (item.id)}
          <li class={s.row}>
            <span class={s.reason}>{item.text.trim() || "Untitled reason"}</span>
            <span class={s.weightNum}>{clampWeight(item.weight)}</span>
          </li>
        {:else}
          <li class={s.empty}>No objections recorded.</li>
        {/each}
      </ul>
    </section>
  </div>

  <footer class={s.foot}>
    <div class={s.seal} aria-label="Verdict status {statusLabel}">
      <span class={s.sealFace}>{statusLabel}</span>
    </div>
    <div class={s.verdict}>
      <span class={s.verdictLabel}>Verdict</span>
      {#if data.verdict.trim()}
        <p class={s.verdictExport}>{data.verdict}</p>
      {:else}
        <p class={s.empty}>No conclusion recorded.</p>
      {/if}
    </div>
  </footer>
</article>
