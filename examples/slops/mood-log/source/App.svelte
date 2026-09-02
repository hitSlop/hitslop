<script lang="ts">
  import { capture } from "@hitslop/runtime";
  import { jsonStore } from "@hitslop/svelte";
  import Trash2 from "@lucide/svelte/icons/trash-2";
  import Icon from "./Icon.svelte";

  type MoodEntry = {
    id: string;
    day: string;
    mood: number; // 1 to 5
    energy: number; // 1 to 5
    note: string;
  };

  type MoodLogData = {
    prompt: string;
    entries: MoodEntry[];
  };

  const MOOD_ORBS = [
    { value: 1, color: "var(--orb-1)", label: "Heavy / Reflective" },
    { value: 2, color: "var(--orb-2)", label: "Low / Subdued" },
    { value: 3, color: "var(--orb-3)", label: "Steady / Centered" },
    { value: 4, color: "var(--orb-4)", label: "Warm / Serene" },
    { value: 5, color: "var(--orb-5)", label: "Radiant / Energized" },
  ];

  const doc = jsonStore<MoodLogData>({
    prompt: "How are you, really?",
    entries: [
      { id: "1", day: "TODAY", mood: 4, energy: 4, note: "Clear head after a quiet morning." },
      { id: "2", day: "YESTERDAY", mood: 5, energy: 5, note: "Deep work clicked. Shipped new templates." },
      { id: "3", day: "TUE 26", mood: 3, energy: 3, note: "A little stretched, still moving forward." },
      { id: "4", day: "MON 25", mood: 4, energy: 4, note: "Good conversations, clear intentions." },
      { id: "5", day: "SUN 24", mood: 2, energy: 2, note: "Needed gentle rest and tea." },
    ],
  });

  let draftMood = $state(4);
  let draftEnergy = $state(4);
  let draftNote = $state("");

  function logEntry() {
    const text = draftNote.trim();
    if (!text) return;
    const now = new Date();
    const dayName = now.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase();
    const dayNum = now.getDate();
    doc.current.entries.unshift({
      id: crypto.randomUUID(),
      day: `${dayName} ${dayNum}`,
      mood: draftMood,
      energy: draftEnergy,
      note: text,
    });
    draftNote = "";
  }

  function removeEntry(id: string) {
    doc.current.entries = doc.current.entries.filter((e) => e.id !== id);
  }

  function getOrbColor(value: number): string {
    return MOOD_ORBS.find((o) => o.value === value)?.color || "var(--orb-3)";
  }
</script>

<main class="journal-canvas">
  <article class="journal-sheet">
    <!-- Header -->
    <header class="journal-header">
      <input
        class="prompt-input"
        aria-label="Journal prompt"
        bind:value={doc.current.prompt}
      />
    </header>

    <!-- Today's Check-in Card -->
    <section class="checkin-card" data-slop-export="hide" aria-label="Today check in">
      <div class="orbs-selector-row">
        <div class="orbs-group" role="radiogroup" aria-label="Select mood">
          {#each MOOD_ORBS as orb}
            <button
              type="button"
              class="mood-orb-btn"
              class:selected={draftMood === orb.value}
              style="background: {orb.color};"
              aria-label={orb.label}
              onclick={() => (draftMood = orb.value)}
            ></button>
          {/each}
        </div>

        <label class="energy-row">
          <span>Energy</span>
          <input
            type="range"
            min="1"
            max="5"
            class="energy-slider"
            aria-label="Energy level 1 to 5"
            bind:value={draftEnergy}
          />
        </label>
      </div>

      <form class="note-input-row" onsubmit={(e) => { e.preventDefault(); logEntry(); }}>
        <input
          class="reflection-input"
          placeholder="One line reflection..."
          aria-label="Reflection note"
          bind:value={draftNote}
        />
        <button type="submit" class="log-btn" aria-label="Log check in">
          Log
        </button>
      </form>
    </section>

    <!-- Timeline List -->
    <ul class="entries-timeline" aria-label="Check-in history">
      {#each doc.current.entries as item (item.id)}
        <li class="entry-item">
          <span
            class="entry-orb"
            style="background: {getOrbColor(item.mood)};"
            aria-hidden="true"
          ></span>
          <div class="entry-meta">
            <span class="entry-day">{item.day}</span>
            <span class="entry-energy">⚡ {item.energy}/5</span>
          </div>
          <p class="entry-note">{item.note}</p>
          <button
            type="button"
            class="delete-entry-btn"
            data-slop-export="hide"
            aria-label="Delete entry"
            onclick={() => removeEntry(item.id)}
          >
            <Trash2 size={12} />
          </button>
        </li>
      {/each}
    </ul>

    <!-- Footer -->
    <footer class="journal-footer">
      <span>{doc.current.entries.length} reflections recorded</span>
      <span>HITSLOP QUIET JOURNAL</span>
    </footer>
  </article>
</main>

{#if capture.isRenderer()}
  <Icon />
{/if}
