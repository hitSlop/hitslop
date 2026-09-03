<script lang="ts">
  import { capture } from "@hitslop/runtime";
  import { jsonStore } from "@hitslop/svelte";
  import Sun from "@lucide/svelte/icons/sun";
  import Moon from "@lucide/svelte/icons/moon";
  import Check from "@lucide/svelte/icons/check";
  import Sparkles from "@lucide/svelte/icons/sparkles";
  import BookOpen from "@lucide/svelte/icons/book-open";
  import { Tabs, Checkbox } from "bits-ui";
  import Icon from "./Icon.svelte";

  type FiveMinuteData = {
    date: string;
    quote: string;
    quoteAuthor: string;
    morningDone: boolean;
    gratitudes: [string, string, string];
    intentions: [string, string, string];
    affirmation: string;
    eveningDone: boolean;
    highlights: [string, string, string];
    lesson: string;
  };

  function todayStr(): string {
    const d = new Date();
    return d.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric", year: "numeric" });
  }

  const store = jsonStore<FiveMinuteData>({
    date: todayStr(),
    quote: "When you arise in the morning, think of what a precious privilege it is to be alive — to breathe, to think, to enjoy, to love.",
    quoteAuthor: "Marcus Aurelius",
    morningDone: true,
    gratitudes: [
      "The quiet steam of the first pour-over coffee at sunrise",
      "A long, encouraging voice note from an old friend",
      "Good health and the crisp September morning air",
    ],
    intentions: [
      "Ship the core prioritization matrices with zero distractions",
      "Cook a fresh dinner and sit down together without phones",
      "Read two chapters of physical book before sleep",
    ],
    affirmation: "I am patient, focused, and present in each conversation.",
    eveningDone: false,
    highlights: [
      "Solved a stubborn layout bug on the first attempt",
      "Walked 4 miles under warm afternoon sunshine",
      "Unexpected laugh with a neighbor on the street",
    ],
    lesson: "Take 5 deep breaths before replying to urgent requests; calmness is contagious.",
  });

  let activeView = $state<"all" | "am" | "pm">("all");
</script>

<main class="journal-container">
  <!-- Linen Notebook Header -->
  <header class="journal-header">
    <div class="header-stamp-row">
      <span class="heritage-text">THE FIVE MINUTE JOURNAL • DAILY RECORD</span>
      <Tabs.Root
        value={activeView}
        onValueChange={(v) => { if (v === "all" || v === "am" || v === "pm") activeView = v; }}
      >
        <Tabs.List class="view-toggles" data-slop-export="hide" aria-label="Journal View">
          <Tabs.Trigger value="all" class="toggle-btn">Full Day</Tabs.Trigger>
          <Tabs.Trigger value="am" class="toggle-btn"><Sun size={11} /> AM</Tabs.Trigger>
          <Tabs.Trigger value="pm" class="toggle-btn"><Moon size={11} /> PM</Tabs.Trigger>
        </Tabs.List>
      </Tabs.Root>
    </div>

    <!-- Daily Date -->
    <div class="date-row">
      <input
        type="text"
        class="date-input"
        bind:value={store.current.date}
        aria-label="Journal Date"
      />
    </div>

    <!-- Daily Quote Card -->
    <div class="quote-card">
      <p class="quote-text">“{store.current.quote}”</p>
      <span class="quote-author">— {store.current.quoteAuthor}</span>
    </div>
  </header>

  <!-- MORNING SECTION -->
  {#if activeView === "all" || activeView === "am"}
    <section class="journal-section morning-section" class:section-completed={store.current.morningDone}>
      <div class="section-title-row">
        <div class="section-title-group">
          <Sun size={15} class="section-icon sun-icon" />
          <h2 class="section-heading">Morning Routine</h2>
        </div>
        <Checkbox.Root
          checked={store.current.morningDone}
          onCheckedChange={(c) => { store.current.morningDone = !!c; }}
          class="complete-pill"
          data-slop-export="hide"
          aria-label="Toggle morning routine completion"
        >
          {#snippet children({ checked })}
            {#if checked}
              <Check size={11} strokeWidth={3} /> Morning Complete
            {:else}
              Mark AM Complete
            {/if}
          {/snippet}
        </Checkbox.Root>
      </div>

      <!-- Question 1: Gratitudes -->
      <div class="prompt-block">
        <label class="prompt-label" for="gratitude-0">I am grateful for...</label>
        <div class="lines-group">
          {#each store.current.gratitudes as _, i}
            <div class="line-row">
              <span class="line-num">1.{i + 1}</span>
              <input
                id="gratitude-{i}"
                type="text"
                class="line-input"
                placeholder="Specific scene, person, or small comfort..."
                bind:value={store.current.gratitudes[i]}
              />
            </div>
          {/each}
        </div>
      </div>

      <!-- Question 2: What would make today great? -->
      <div class="prompt-block">
        <label class="prompt-label" for="intention-0">What would make today great?</label>
        <div class="lines-group">
          {#each store.current.intentions as _, i}
            <div class="line-row">
              <span class="line-num">2.{i + 1}</span>
              <input
                id="intention-{i}"
                type="text"
                class="line-input"
                placeholder="Intention or milestone #{i + 1}..."
                bind:value={store.current.intentions[i]}
              />
            </div>
          {/each}
        </div>
      </div>

      <!-- Question 3: Daily Affirmation -->
      <div class="prompt-block">
        <label class="prompt-label" for="affirmation-input">Daily Affirmation</label>
        <div class="affirmation-row">
          <span class="affirmation-prefix">I am</span>
          <input
            id="affirmation-input"
            type="text"
            class="affirmation-input"
            placeholder="grounded, capable, and kind in all things..."
            bind:value={store.current.affirmation}
          />
        </div>
      </div>
    </section>
  {/if}

  <!-- EVENING SECTION -->
  {#if activeView === "all" || activeView === "pm"}
    <section class="journal-section evening-section" class:section-completed={store.current.eveningDone}>
      <div class="section-title-row">
        <div class="section-title-group">
          <Moon size={15} class="section-icon moon-icon" />
          <h2 class="section-heading">Evening Reflection</h2>
        </div>
        <Checkbox.Root
          checked={store.current.eveningDone}
          onCheckedChange={(c) => { store.current.eveningDone = !!c; }}
          class="complete-pill"
          data-slop-export="hide"
          aria-label="Toggle evening reflection completion"
        >
          {#snippet children({ checked })}
            {#if checked}
              <Check size={11} strokeWidth={3} /> Evening Complete
            {:else}
              Mark PM Complete
            {/if}
          {/snippet}
        </Checkbox.Root>
      </div>

      <!-- Question 4: 3 Amazing things that happened today -->
      <div class="prompt-block">
        <label class="prompt-label" for="highlight-0">3 Amazing things that happened today...</label>
        <div class="lines-group">
          {#each store.current.highlights as _, i}
            <div class="line-row">
              <span class="line-num">3.{i + 1}</span>
              <input
                id="highlight-{i}"
                type="text"
                class="line-input"
                placeholder="Highlight #{i + 1}..."
                bind:value={store.current.highlights[i]}
              />
            </div>
          {/each}
        </div>
      </div>

      <!-- Question 5: How could I have made today even better? -->
      <div class="prompt-block">
        <label class="prompt-label" for="lesson-input">What did I learn / How could I have made today better?</label>
        <div class="line-row">
          <span class="line-num">4.1</span>
          <input
            id="lesson-input"
            type="text"
            class="line-input"
            placeholder="Insight, boundary, or reflection..."
            bind:value={store.current.lesson}
          />
        </div>
      </div>
    </section>
  {/if}
</main>

{#if capture.isRenderer()}
  <Icon />
{/if}
