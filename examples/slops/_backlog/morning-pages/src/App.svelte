<script lang="ts">
  import { capture, ready } from "@hitslop/runtime";
  import { jsonStore, IconTarget, ExportTarget } from "@hitslop/svelte";
  import { onDestroy, onMount, tick, untrack } from "svelte";
  import { Tween, prefersReducedMotion } from "svelte/motion";
  import { cubicOut } from "svelte/easing";
  import { Progress } from "bits-ui";
  import morningSchema from "../schema";
  import Icon from "./Icon.svelte";
  import Export from "./Export.svelte";
  import * as s from "./styles.css";

  const TARGET = 750;
  const SAMPLE = `The morning air is crisp and cool through the open sash window. There is a slight hum from the street as delivery vans start their morning routes. My head feels a little foggy from staying up reading, but writing this out is already softening the edges.

I was thinking about the project roadmap and how easy it is to overcomplicate the architecture when all that really matters is simplicity and responsiveness. Why do we always feel the urge to build castles when a sturdy oak table is what is actually needed? The more I practice putting thoughts down without judging them, the easier it gets to see what is real and what is just nervous static.

Today I want to keep my attention undivided. No multitasking, no phantom phone checks while waiting for builds. If I am working on the prioritization matrix, I want to be entirely inside that problem until it breathes on its own. Three hours of genuine focus is worth twenty hours of fractured scrolling. The coffee is finally at that perfect drinkable temperature, rich and dark. The light across the desk is shifting from pale grey to pale gold.`;

  function dateKey(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
  function formatDisplayDate(key: string): string {
    const [y, m, d] = key.split("-").map(Number);
    return new Date(y, (m ?? 1) - 1, d).toLocaleDateString(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  }
  function countWords(text: string): number {
    const trimmed = text.trim();
    return trimmed === "" ? 0 : trimmed.split(/\s+/).length;
  }
  function todayKey(): string {
    return dateKey(new Date());
  }

  const today = todayKey();
  const doc = jsonStore({ schema: morningSchema, initial: {
    currentKey: today,
    entries: {
      [today]: { date: today, text: SAMPLE, completedAt: "" },
    },
  } });

  $effect(() => { if (doc.isReady) ready(); });

  $effect(() => {
    const key = doc.current.currentKey;
    if (!doc.current.entries[key]) {
      doc.current.entries[key] = { date: key, text: "", completedAt: "" };
    }
  });

  const active = $derived(doc.current.entries[doc.current.currentKey]);
  const wordsCount = $derived(countWords(active?.text ?? ""));
  const progressPct = $derived(Math.min(100, Math.round((wordsCount / TARGET) * 100)));
  const page1Done = $derived(wordsCount >= 250);
  const page2Done = $derived(wordsCount >= 500);
  const page3Done = $derived(wordsCount >= TARGET);
  const isToday = $derived(doc.current.currentKey === todayKey());

  const odometer = new Tween(untrack(() => wordsCount), { duration: 350, easing: cubicOut });
  let initialized = false;

  $effect(() => {
    const instant = !initialized || !doc.isReady || prefersReducedMotion.current;
    void odometer.set(wordsCount, { duration: instant ? 0 : 350, delay: 0 });
    initialized = doc.isReady;
  });

  $effect(() => {
    if (!doc.isReady || !active || wordsCount < TARGET || active.completedAt) return;
    active.completedAt = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  });

  onMount(() => capture.onPrepare(async () => {
    await odometer.set(wordsCount, { duration: 0, delay: 0 });
    await tick();
  }));
  onDestroy(() => {
    void odometer.set(odometer.target, { duration: 0, delay: 0 });
    doc.destroy();
  });

  function openDay(key: string) {
    if (!doc.current.entries[key]) {
      doc.current.entries[key] = { date: key, text: "", completedAt: "" };
    }
    doc.current.currentKey = key;
  }
  function shiftDate(deltaDays: number) {
    const [y, m, d] = doc.current.currentKey.split("-").map(Number);
    const date = new Date(y, (m ?? 1) - 1, d);
    date.setDate(date.getDate() + deltaDays);
    openDay(dateKey(date));
  }
  function sizeToText(node: HTMLTextAreaElement, _value: string) {
    let timer: ReturnType<typeof setTimeout>;
    const resize = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        node.style.height = "auto";
        const min = node.parentElement?.clientHeight ?? 0;
        node.style.height = `${Math.max(node.scrollHeight, min)}px`;
      });
    };
    const observer = new ResizeObserver(resize);
    observer.observe(node);
    if (node.parentElement) observer.observe(node.parentElement);
    node.addEventListener("input", resize);
    resize();
    return {
      update: resize,
      destroy() {
        clearTimeout(timer);
        observer.disconnect();
        node.removeEventListener("input", resize);
      },
    };
  }

  const odometerDigits = $derived(String(Math.max(0, Math.round(odometer.current))).padStart(3, "0"));
  const fillScale = $derived(Math.max(0, Math.min(1, odometer.current / TARGET)));
</script>

<main class={s.pad} data-slop-selection="none" aria-busy={doc.isLoading} aria-label="Morning pages legal pad">
  <header class={s.stub}>
    <span class={s.perforations} aria-hidden="true"></span>
    <div class={s.brandRow}>
      <div class={s.brand}>
        <span class={s.brandTitle}>Morning Pages</span>
        <span class={s.brandSub}>Julia Cameron · three handwritten pages</span>
      </div>
      <div class={s.dateNav} data-slop-export="hide">
        <button type="button" class={s.navBtn} onclick={() => shiftDate(-1)} aria-label="Previous day">‹</button>
        <button type="button" class={s.navBtn} data-today="true" onclick={() => openDay(todayKey())} disabled={isToday}>Today</button>
        <button type="button" class={s.navBtn} onclick={() => shiftDate(1)} aria-label="Next day">›</button>
      </div>
    </div>
    <div class={s.headlineRow}>
      <h1 class={s.dateHeadline}>{formatDisplayDate(doc.current.currentKey)}</h1>
      {#if page3Done}
        <span class={s.stamp}>3 pages cleared</span>
      {/if}
    </div>
    <Progress.Root
      class={s.odometer}
      value={wordsCount}
      max={TARGET}
      aria-label="Morning Pages word progress"
    >
      <div class={s.odometerReadout}>
        <span class={s.odometerDigits} data-complete={page3Done} aria-hidden="true">{odometerDigits}</span>
        <span class={s.odometerPrecise} aria-live="polite">{wordsCount} / {TARGET} words · {progressPct}%</span>
      </div>
      <div class={s.pagesTrack}>
        <div class={s.fillTrack} aria-hidden="true">
          <div class={s.fill} data-complete={page3Done} style:transform={`scaleX(${fillScale})`}></div>
        </div>
        <div class={s.segments} aria-hidden="true">
          <span class={s.segment} data-done={page1Done}>Page 1 · 250</span>
          <span class={s.segment} data-done={page2Done}>Page 2 · 500</span>
          <span class={s.segment} data-done={page3Done}>Page 3 · 750</span>
        </div>
      </div>
    </Progress.Root>
  </header>

  <article class={s.sheet}>
    <span class={s.marginRule} aria-hidden="true"></span>
    <div class={s.holes} aria-hidden="true">
      <span class={s.hole}></span>
      <span class={s.hole}></span>
      <span class={s.hole}></span>
      <span class={s.hole}></span>
    </div>
    {#if active}
      <textarea
        class={s.editor}
        use:sizeToText={active.text}
        placeholder="Start writing without stopping or self-editing. Pour every thought onto the page until the odometer turns."
        bind:value={active.text}
        aria-label="Morning Pages writing area"
        spellcheck="true"
      ></textarea>
    {/if}
  </article>

  <footer class={s.footer} data-slop-export="hide">
    There is no wrong way to do Morning Pages. They are not high art. They are simply moving the hand across the page and writing down whatever comes.
  </footer>

  {#if doc.error}
    <div class={s.error} role="alert">
      <span>{doc.isReady ? "Changes haven’t been saved." : "This pad couldn’t be loaded."} {doc.error}</span>
    </div>
  {:else if doc.isLoading}
    <p class={s.error} role="status">Opening today’s pages…</p>
  {/if}
</main>

<IconTarget><Icon words={wordsCount} /></IconTarget>
<ExportTarget>
  <Export
    dateLabel={formatDisplayDate(doc.current.currentKey)}
    text={active?.text ?? ""}
    words={wordsCount}
    completed={page3Done}
  />
</ExportTarget>
