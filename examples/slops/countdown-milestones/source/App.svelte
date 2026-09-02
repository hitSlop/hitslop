<script lang="ts">
  import { capture } from "@hitslop/runtime";
  import { jsonStore } from "@hitslop/svelte";
  import Plus from "@lucide/svelte/icons/plus";
  import Trash2 from "@lucide/svelte/icons/trash-2";
  import Icon from "./Icon.svelte";
  import { onDestroy } from "svelte";

  type Milestone = {
    id: string;
    title: string;
    date: string;
    done: boolean;
  };

  type CountdownData = {
    title: string;
    subtitle: string;
    targetDate: string;
    milestones: Milestone[];
  };

  const doc = jsonStore<CountdownData>({
    title: "Vacation Hawaii 🌴",
    subtitle: "Flight on May 28, 2027 · Terminal 8",
    targetDate: "2027-05-28T09:30",
    milestones: [
      { id: "1", title: "Book beachfront condo", date: "Jan 15", done: true },
      { id: "2", title: "Reserve rental jeep", date: "Feb 20", done: true },
      { id: "3", title: "Pack bags & snorkel gear", date: "May 25", done: false },
      { id: "4", title: "Check in for flight online", date: "May 27", done: false },
    ],
  });

  let now = $state(Date.now());
  const timer = setInterval(() => {
    now = Date.now();
  }, 1000);

  onDestroy(() => {
    clearInterval(timer);
  });

  const targetMs = $derived.by(() => {
    const parsed = new Date(doc.current.targetDate).getTime();
    return isNaN(parsed) ? Date.now() + 86400000 : parsed;
  });

  const diffSeconds = $derived(Math.max(0, Math.floor((targetMs - now) / 1000)));
  const days = $derived(String(Math.floor(diffSeconds / 86400)).padStart(2, "0"));
  const hours = $derived(String(Math.floor((diffSeconds % 86400) / 3600)).padStart(2, "0"));
  const minutes = $derived(String(Math.floor((diffSeconds % 3600) / 60)).padStart(2, "0"));
  const seconds = $derived(String(diffSeconds % 60).padStart(2, "0"));

  const completedCount = $derived(doc.current.milestones.filter((m) => m.done).length);
  const totalCount = $derived(doc.current.milestones.length);
  const percentComplete = $derived(totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0);

  function addMilestone() {
    doc.current.milestones.push({
      id: crypto.randomUUID(),
      title: "New milestone checkpoint",
      date: "Target date",
      done: false,
    });
  }

  function removeMilestone(id: string) {
    doc.current.milestones = doc.current.milestones.filter((m) => m.id !== id);
  }
</script>

<main class="countdown-canvas">
  <article class="capsule-chassis">
    <!-- Smoked Glass Glowing Readout -->
    <header class="departure-bezel">
      <div class="header-row">
        <input
          class="title-input"
          aria-label="Event title"
          bind:value={doc.current.title}
        />
        <input
          class="subtitle-input"
          aria-label="Event subtitle"
          bind:value={doc.current.subtitle}
        />
      </div>

      <div class="digits-grid" aria-label="Countdown time remaining">
        <div class="digit-unit">
          <div class="digit-box">{days}</div>
          <span class="digit-label">Days</span>
        </div>
        <span class="digit-sep">:</span>
        <div class="digit-unit">
          <div class="digit-box">{hours}</div>
          <span class="digit-label">Hours</span>
        </div>
        <span class="digit-sep">:</span>
        <div class="digit-unit">
          <div class="digit-box">{minutes}</div>
          <span class="digit-label">Mins</span>
        </div>
        <span class="digit-sep">:</span>
        <div class="digit-unit">
          <div class="digit-box">{seconds}</div>
          <span class="digit-label">Secs</span>
        </div>
      </div>

      <div class="target-date-row" data-slop-export="hide">
        <span>Target:</span>
        <input
          type="datetime-local"
          class="target-date-input"
          aria-label="Target date and time"
          bind:value={doc.current.targetDate}
        />
      </div>
    </header>

    <!-- Milestones Checkpoints -->
    <section class="milestones-section" aria-label="Milestones timeline">
      <div class="milestones-header">
        <span class="milestones-title">Milestones</span>
        <button
          class="add-milestone-btn"
          data-slop-export="hide"
          aria-label="Add milestone"
          onclick={addMilestone}
        >
          <Plus size={14} />
        </button>
      </div>

      <ul class="milestones-list">
        {#each doc.current.milestones as item (item.id)}
          <li class="milestone-item" class:done={item.done}>
            <input
              type="checkbox"
              class="milestone-check"
              aria-label="Mark milestone complete"
              bind:checked={item.done}
            />
            <div class="milestone-info">
              <input
                class="milestone-title-input"
                aria-label="Milestone description"
                bind:value={item.title}
              />
              <input
                class="milestone-date-input"
                aria-label="Milestone target date"
                bind:value={item.date}
              />
            </div>
            <button
              class="delete-btn"
              data-slop-export="hide"
              aria-label="Delete milestone"
              onclick={() => removeMilestone(item.id)}
            >
              <Trash2 size={13} />
            </button>
          </li>
        {/each}
      </ul>
    </section>

    <!-- Progress Footer -->
    <footer class="capsule-footer">
      <span>{completedCount} of {totalCount} completed</span>
      <div class="progress-track">
        <div class="progress-bar" style="width: {percentComplete}%;"></div>
      </div>
      <span>{percentComplete}%</span>
    </footer>
  </article>
</main>

{#if capture.isRenderer()}
  <Icon />
{/if}
