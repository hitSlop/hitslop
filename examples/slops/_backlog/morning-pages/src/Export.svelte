<script lang="ts">
  import * as s from "./styles.css";

  const TARGET = 750;
  let { dateLabel, text, words, completed }: {
    dateLabel: string;
    text: string;
    words: number;
    completed: boolean;
  } = $props();
  const progressPct = $derived(Math.min(100, Math.round((words / TARGET) * 100)));
  const fillScale = $derived(Math.max(0, Math.min(1, words / TARGET)));
  const page1Done = $derived(words >= 250);
  const page2Done = $derived(words >= 500);
</script>

<article class={s.exportPad} aria-label="Exported morning pages for {dateLabel}">
  <header class={s.stub}>
    <span class={s.perforations} aria-hidden="true"></span>
    <div class={s.brandRow}>
      <div class={s.brand}>
        <span class={s.brandTitle}>Morning Pages</span>
        <span class={s.brandSub}>Julia Cameron · three handwritten pages</span>
      </div>
    </div>
    <div class={s.headlineRow}>
      <h1 class={s.dateHeadline}>{dateLabel}</h1>
      {#if completed}<span class={s.stamp}>3 pages cleared</span>{/if}
    </div>
    <div class={s.odometer}>
      <div class={s.odometerReadout}>
        <span class={s.odometerDigits} data-complete={completed}>{String(words).padStart(3, "0")}</span>
        <span class={s.odometerPrecise}>{words} / {TARGET} words · {progressPct}%</span>
      </div>
      <div class={s.pagesTrack}>
        <div class={s.fillTrack} aria-hidden="true">
          <div class={s.fill} data-complete={completed} style:transform={`scaleX(${fillScale})`}></div>
        </div>
        <div class={s.segments} aria-hidden="true">
          <span class={s.segment} data-done={page1Done}>Page 1 · 250</span>
          <span class={s.segment} data-done={page2Done}>Page 2 · 500</span>
          <span class={s.segment} data-done={completed}>Page 3 · 750</span>
        </div>
      </div>
    </div>
  </header>
  <section class={s.sheet}>
    <span class={s.marginRule} aria-hidden="true"></span>
    <div class={s.holes} aria-hidden="true">
      <span class={s.hole}></span>
      <span class={s.hole}></span>
      <span class={s.hole}></span>
      <span class={s.hole}></span>
    </div>
    {#if text.trim()}
      <p class={s.writing}>{text}</p>
    {:else}
      <p class={s.empty}>Nothing written this morning.</p>
    {/if}
  </section>
</article>
