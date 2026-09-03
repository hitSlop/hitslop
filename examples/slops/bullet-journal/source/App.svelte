<script lang="ts">
  import { capture } from "@hitslop/runtime";
  import { jsonStore } from "@hitslop/svelte";
  import Plus from "@lucide/svelte/icons/plus";
  import Trash2 from "@lucide/svelte/icons/trash-2";
  import Star from "@lucide/svelte/icons/star";
  import Bookmark from "@lucide/svelte/icons/bookmark";
  import Calendar from "@lucide/svelte/icons/calendar";
  import List from "@lucide/svelte/icons/list";
  import Icon from "./Icon.svelte";

  type Signifier = "task" | "complete" | "migrated" | "scheduled" | "event" | "note";

  type Entry = {
    id: string;
    type: Signifier;
    star: boolean;
    text: string;
  };

  type MonthlyItem = {
    day: number;
    weekday: string;
    text: string;
  };

  type BulletJournalData = {
    date: string;
    monthTitle: string;
    entries: Entry[];
    monthlyLog: MonthlyItem[];
  };

  function uid(): string {
    return Math.random().toString(36).slice(2, 9);
  }

  function todayStr(): string {
    const d = new Date();
    return d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
  }

  const SIGNIFIERS: { type: Signifier; symbol: string; label: string }[] = [
    { type: "task", symbol: "•", label: "Task" },
    { type: "complete", symbol: "×", label: "Completed" },
    { type: "migrated", symbol: "›", label: "Migrated" },
    { type: "scheduled", symbol: "‹", label: "Scheduled" },
    { type: "event", symbol: "○", label: "Event" },
    { type: "note", symbol: "—", label: "Note" },
  ];

  const CYCLE: Signifier[] = ["task", "complete", "migrated", "scheduled", "event", "note"];

  const store = jsonStore<BulletJournalData>({
    date: todayStr(),
    monthTitle: "September 2026",
    entries: [
      { id: "e1", type: "task", star: true, text: "Ship the Eisenhower & Ivy Lee productivity dockets" },
      { id: "e2", type: "complete", star: false, text: "Morning review of server latency telemetry" },
      { id: "e3", type: "event", star: false, text: "14:00 Studio design sync with architectural team" },
      { id: "e4", type: "note", star: false, text: "Good idea: A single physical balance beam clarifies weighted decisions instantly" },
      { id: "e5", type: "migrated", star: false, text: "Update developer documentation on packaging invariants" },
      { id: "e6", type: "task", star: false, text: "Order heavier grain fountain pen ink refills" },
    ],
    monthlyLog: [
      { day: 1, weekday: "Tu", text: "Labor Day / Studio Planning" },
      { day: 2, weekday: "We", text: "Core templates sprint kickoff" },
      { day: 3, weekday: "Th", text: "Release candidate verification" },
      { day: 4, weekday: "Fr", text: "Team demo & retrospective" },
      { day: 12, weekday: "Sa", text: "Mountain trail run" },
      { day: 15, weekday: "Tu", text: "Quarterly budget audit" },
    ],
  });

  let activeTab = $state<"daily" | "monthly">("daily");
  let newEntryText = $state("");
  let newEntryType = $state<Signifier>("task");
  let newEntryStar = $state(false);

  function cycleSignifier(id: string) {
    store.current.entries = store.current.entries.map((e) => {
      if (e.id !== id) return e;
      const idx = CYCLE.indexOf(e.type);
      const next = CYCLE[(idx + 1) % CYCLE.length];
      return { ...e, type: next };
    });
  }

  function toggleStar(id: string) {
    store.current.entries = store.current.entries.map((e) =>
      e.id === id ? { ...e, star: !e.star } : e
    );
  }

  function deleteEntry(id: string) {
    store.current.entries = store.current.entries.filter((e) => e.id !== id);
  }

  function addEntry() {
    const text = newEntryText.trim();
    if (!text) return;
    store.current.entries = [
      ...store.current.entries,
      { id: uid(), type: newEntryType, star: newEntryStar, text },
    ];
    newEntryText = "";
    newEntryStar = false;
  }

  function getSignifierSymbol(type: Signifier): string {
    return SIGNIFIERS.find((s) => s.type === type)?.symbol ?? "•";
  }
</script>

<main class="bujo-container">
  <!-- Bookmark Tab Ribbon Header -->
  <header class="bujo-header">
    <div class="ribbon-strip" data-slop-export="hide">
      <button
        type="button"
        class="tab-btn"
        class:active={activeTab === "daily"}
        onclick={() => { activeTab = "daily"; }}
      >
        <List size={12} /> Daily Rapid Log
      </button>
      <button
        type="button"
        class="tab-btn"
        class:active={activeTab === "monthly"}
        onclick={() => { activeTab = "monthly"; }}
      >
        <Calendar size={12} /> Monthly Index
      </button>
    </div>

    <!-- Signifier Legend Pill -->
    <div class="signifier-legend" data-slop-export="hide">
      {#each SIGNIFIERS as s}
        <span class="legend-item" title={s.label}>
          <strong class="sym">{s.symbol}</strong> {s.label}
        </span>
      {/each}
      <span class="legend-item" title="Priority">
        <strong class="sym">*</strong> Priority
      </span>
    </div>
  </header>

  <!-- Dot Grid Notebook Canvas -->
  <article class="notebook-sheet">
    {#if activeTab === "daily"}
      <!-- DAILY LOG SPREAD -->
      <div class="daily-spread">
        <div class="spread-title-row">
          <h1 class="spread-date">{store.current.date}</h1>
          <span class="page-corner-num">pg. 42</span>
        </div>

        <!-- Rapid Log Entries -->
        <ul class="entry-list">
          {#each store.current.entries as item (item.id)}
            <li class="entry-row" class:is-complete={item.type === "complete"}>
              <!-- Priority Star -->
              <button
                type="button"
                class="star-btn"
                class:active={item.star}
                onclick={() => toggleStar(item.id)}
                title="Toggle priority star (*)"
                aria-label="Toggle priority"
              >
                {#if item.star}
                  <Star size={11} fill="currentColor" />
                {:else}
                  <span class="star-placeholder">·</span>
                {/if}
              </button>

              <!-- Rapid Log Signifier Toggle -->
              <button
                type="button"
                class="signifier-btn signifier-{item.type}"
                onclick={() => cycleSignifier(item.id)}
                title="Click to cycle signifier: • → × → › → ‹ → ○ → —"
                aria-label="Signifier {item.type}"
              >
                <span class="signifier-char">{getSignifierSymbol(item.type)}</span>
              </button>

              <!-- Entry Text -->
              <input
                type="text"
                class="entry-text"
                bind:value={item.text}
                aria-label="Rapid log entry"
              />

              <!-- Delete Action -->
              <button
                type="button"
                class="del-btn"
                data-slop-export="hide"
                onclick={() => deleteEntry(item.id)}
                title="Delete entry"
              >
                <Trash2 size={12} />
              </button>
            </li>
          {/each}
        </ul>

        <!-- Add Rapid Log Entry Form -->
        <form
          class="add-entry-form"
          data-slop-export="hide"
          onsubmit={(e) => { e.preventDefault(); addEntry(); }}
        >
          <!-- Star Toggle for new item -->
          <button
            type="button"
            class="star-toggle-btn"
            class:active={newEntryStar}
            onclick={() => { newEntryStar = !newEntryStar; }}
            title="Mark as Priority (*)"
          >
            <Star size={12} fill={newEntryStar ? "currentColor" : "none"} />
          </button>

          <!-- Type Selector for new item -->
          <select class="type-select" bind:value={newEntryType} aria-label="Signifier type">
            {#each SIGNIFIERS as s}
              <option value={s.type}>{s.symbol} {s.label}</option>
            {/each}
          </select>

          <!-- Input -->
          <input
            type="text"
            class="add-input"
            placeholder="Rapid log an item (task, event, note)..."
            bind:value={newEntryText}
          />

          <button type="submit" class="add-submit" aria-label="Add entry">
            <Plus size={14} />
          </button>
        </form>
      </div>
    {:else}
      <!-- MONTHLY INDEX SPREAD -->
      <div class="monthly-spread">
        <div class="spread-title-row">
          <h1 class="spread-date">{store.current.monthTitle}</h1>
          <span class="page-corner-num">pg. 40</span>
        </div>

        <div class="monthly-grid">
          {#each store.current.monthlyLog as m, i (i)}
            <div class="month-row">
              <span class="month-day">{String(m.day).padStart(2, "0")}</span>
              <span class="month-wkday">{m.weekday}</span>
              <input
                type="text"
                class="month-event-input"
                placeholder="Key event or milestone..."
                bind:value={store.current.monthlyLog[i].text}
              />
            </div>
          {/each}
        </div>
      </div>
    {/if}
  </article>
</main>

{#if capture.isRenderer()}
  <Icon />
{/if}
