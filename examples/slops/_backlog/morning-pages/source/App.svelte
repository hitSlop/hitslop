<script lang="ts">
  import { capture } from "@hitslop/runtime";
  import { jsonStore } from "@hitslop/svelte";
  import Check from "@lucide/svelte/icons/check";
  import Feather from "@lucide/svelte/icons/feather";
  import Calendar from "@lucide/svelte/icons/calendar";
  import ChevronLeft from "@lucide/svelte/icons/chevron-left";
  import ChevronRight from "@lucide/svelte/icons/chevron-right";
  import Award from "@lucide/svelte/icons/award";
  import { Progress } from "bits-ui";
  import Icon from "./Icon.svelte";

  type DayEntry = {
    date: string;
    text: string;
    completedAt?: string;
  };

  type MorningPagesData = {
    currentKey: string;
    entries: Record<string, DayEntry>;
  };

  function dateKey(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  function formatDisplayDate(key: string): string {
    const [y, m, d] = key.split("-").map(Number);
    const date = new Date(y, m - 1, d);
    return date.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  }

  const today = dateKey(new Date());

  const store = jsonStore<MorningPagesData>({
    currentKey: today,
    entries: {
      [today]: {
        date: today,
        text: `The morning air is crisp and cool through the open sash window. There is a slight hum from the street as delivery vans start their morning routes. My head feels a little foggy from staying up reading, but writing this out is already softening the edges.

I was thinking about the project roadmap and how easy it is to overcomplicate the architecture when all that really matters is simplicity and responsiveness. Why do we always feel the urge to build castles when a sturdy oak table is what is actually needed? The more I practice putting thoughts down without judging them, the easier it gets to see what is real and what is just nervous static.

Today I want to keep my attention undivided. No multitasking, no phantom phone checks while waiting for builds. If I am working on the prioritzation matrix, I want to be entirely inside that problem until it breathes on its own. Three hours of genuine focus is worth twenty hours of fractured scrolling. The coffee is finally at that perfect drinkable temperature, rich and dark. The light across the desk is shifting from pale grey to pale gold.`,
        completedAt: undefined,
      },
    },
  });

  // Ensure current entry exists
  $effect(() => {
    if (!store.current.entries[store.current.currentKey]) {
      store.current.entries[store.current.currentKey] = {
        date: store.current.currentKey,
        text: "",
        completedAt: undefined,
      };
    }
  });

  const activeEntry = $derived(
    store.current.entries[store.current.currentKey] || { date: store.current.currentKey, text: "" }
  );

  const wordsCount = $derived(
    activeEntry.text.trim() === "" ? 0 : activeEntry.text.trim().split(/\s+/).length
  );

  const TARGET_WORDS = 750;
  const progressPct = $derived(Math.min(100, Math.round((wordsCount / TARGET_WORDS) * 100)));
  const page1Done = $derived(wordsCount >= 250);
  const page2Done = $derived(wordsCount >= 500);
  const page3Done = $derived(wordsCount >= 750);

  // When crossing 750 words, record completedAt
  $effect(() => {
    if (wordsCount >= TARGET_WORDS && !activeEntry.completedAt) {
      store.current.entries[store.current.currentKey].completedAt = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }
  });

  function shiftDate(deltaDays: number) {
    const [y, m, d] = store.current.currentKey.split("-").map(Number);
    const date = new Date(y, m - 1, d);
    date.setDate(date.getDate() + deltaDays);
    const newKey = dateKey(date);
    store.current.currentKey = newKey;
  }

  function goToToday() {
    store.current.currentKey = today;
  }
</script>

<main class="pages-container">
  <!-- Pad Header -->
  <header class="pad-header">
    <div class="pad-meta-row">
      <div class="brand-group">
        <Feather size={13} class="brand-icon" />
        <span class="brand-title">MORNING PAGES</span>
        <span class="brand-sub">JULIA CAMERON • THREE HANDWRITTEN PAGES</span>
      </div>

      <!-- Date Navigator -->
      <div class="date-navigator" data-slop-export="hide">
        <button
          type="button"
          class="nav-btn"
          onclick={() => shiftDate(-1)}
          title="Previous day"
          aria-label="Previous day"
        >
          <ChevronLeft size={13} />
        </button>
        <button
          type="button"
          class="today-btn"
          onclick={goToToday}
          title="Jump to today"
        >
          Today
        </button>
        <button
          type="button"
          class="nav-btn"
          onclick={() => shiftDate(1)}
          title="Next day"
          aria-label="Next day"
        >
          <ChevronRight size={13} />
        </button>
      </div>
    </div>

    <div class="date-headline-row">
      <h1 class="date-headline">{formatDisplayDate(store.current.currentKey)}</h1>
      {#if page3Done}
        <div class="completion-stamp">
          <Award size={13} />
          <span>3 Pages Cleared</span>
        </div>
      {/if}
    </div>

    <!-- Live Word Odometer & 3-Page Gauge -->
    <Progress.Root
      value={wordsCount}
      max={TARGET_WORDS}
      class="progress-bar-card"
      aria-label="Morning Pages word progress"
    >
      <div class="odometer-row">
        <span class="odometer-label">Word Count:</span>
        <span class="odometer-val">{wordsCount} / {TARGET_WORDS} words</span>
        <span class="odometer-pct">{progressPct}%</span>
      </div>

      <div class="pages-three-segmented">
        <div class="page-segment" class:is-done={page1Done}>
          <span class="segment-label">Page 1 (250w)</span>
        </div>
        <div class="page-segment" class:is-done={page2Done}>
          <span class="segment-label">Page 2 (500w)</span>
        </div>
        <div class="page-segment" class:is-done={page3Done}>
          <span class="segment-label">Page 3 (750w)</span>
        </div>
      </div>
    </Progress.Root>
  </header>

  <!-- Distraction-free Writing Paper -->
  <article class="writing-sheet">
    <div class="sheet-margin-line"></div>
    <textarea
      class="editor-textarea"
      placeholder="Start writing without stopping or self-editing. Pour every thought, anxiety, curiosity, or stream of consciousness onto the page until the odometer turns gold..."
      bind:value={store.current.entries[store.current.currentKey].text}
      aria-label="Morning Pages writing area"
    ></textarea>
  </article>

  <!-- Footnote reminder -->
  <footer class="sheet-footer" data-slop-export="hide">
    <p class="foot-reminder">
      “There is no wrong way to do Morning Pages. They are not high art. They are simply moving the hand across the page and writing down whatever comes.”
    </p>
  </footer>
</main>

{#if capture.isRenderer()}
  <Icon />
{/if}
