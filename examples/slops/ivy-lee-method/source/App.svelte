<script lang="ts">
  import { capture } from "@hitslop/runtime";
  import { jsonStore } from "@hitslop/svelte";
  import Check from "@lucide/svelte/icons/check";
  import ArrowUp from "@lucide/svelte/icons/arrow-up";
  import ArrowDown from "@lucide/svelte/icons/arrow-down";
  import RotateCcw from "@lucide/svelte/icons/rotate-ccw";
  import Zap from "@lucide/svelte/icons/zap";
  import Icon from "./Icon.svelte";

  type Task = { id: string; text: string; done: boolean };

  type IvyLeeData = {
    date: string;
    tasks: Task[];
    notes: string;
  };

  function todayStr(): string {
    const d = new Date();
    return d.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
  }

  function tomorrowStr(): string {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
  }

  const store = jsonStore<IvyLeeData>({
    date: todayStr(),
    tasks: [
      { id: "1", text: "Finalize quarterly financial model", done: false },
      { id: "2", text: "Review candidate take-home submission", done: false },
      { id: "3", text: "Draft customer onboarding email series", done: false },
      { id: "4", text: "Sync with design team on design tokens", done: true },
      { id: "5", text: "Clear urgent support escalations", done: false },
      { id: "6", text: "Plan tomorrow’s 6 priorities at sundown", done: false },
    ],
    notes: "Remember: Single-task only. Never move to the next item until the current one is finished.",
  });

  const completedCount = $derived(store.current.tasks.filter((t) => t.done).length);
  const activeTaskIndex = $derived(store.current.tasks.findIndex((t) => !t.done));

  function toggleDone(index: number) {
    const item = store.current.tasks[index];
    if (!item) return;
    store.current.tasks[index] = { ...item, done: !item.done };
  }

  function moveUp(index: number) {
    if (index <= 0) return;
    const items = [...store.current.tasks];
    const temp = items[index];
    items[index] = items[index - 1];
    items[index - 1] = temp;
    store.current.tasks = items;
  }

  function moveDown(index: number) {
    if (index >= store.current.tasks.length - 1) return;
    const items = [...store.current.tasks];
    const temp = items[index];
    items[index] = items[index + 1];
    items[index + 1] = temp;
    store.current.tasks = items;
  }

  function rollover() {
    // Collect incomplete items
    const incomplete = store.current.tasks.filter((t) => !t.done);
    const newTasks: Task[] = [];
    for (let i = 0; i < 6; i++) {
      if (i < incomplete.length) {
        newTasks.push({ id: String(i + 1), text: incomplete[i].text, done: false });
      } else {
        newTasks.push({ id: String(i + 1), text: "", done: false });
      }
    }
    store.current.tasks = newTasks;
    store.current.date = tomorrowStr();
  }
</script>

<main class="ledger-container">
  <!-- Card Header -->
  <header class="ledger-header">
    <div class="brand-row">
      <span class="brand-mark">NO. 1918</span>
      <span class="brand-rule">RULE: STRICT SINGLE-TASKING</span>
    </div>
    <div class="title-row">
      <h1 class="ledger-title">Ivy Lee Method</h1>
      <input
        type="text"
        class="ledger-date"
        bind:value={store.current.date}
        aria-label="Docket Date"
      />
    </div>

    <!-- Progress Indicator -->
    <div class="progress-section">
      <div class="progress-labels">
        <span class="progress-text">{completedCount} of 6 finished</span>
        <span class="completion-pct">{Math.round((completedCount / 6) * 100)}%</span>
      </div>
      <div class="progress-track">
        {#each { length: 6 } as _, i}
          <div class="progress-step" class:step-filled={i < completedCount}></div>
        {/each}
      </div>
    </div>
  </header>

  <!-- The Strict 6-Slot Strip -->
  <section class="slots-section" aria-label="Six daily tasks">
    {#each store.current.tasks as task, index (index)}
      {@const isActive = index === activeTaskIndex}
      <article
        class="task-row"
        class:is-active={isActive}
        class:is-done={task.done}
      >
        <!-- Slot Number Badge -->
        <div class="slot-badge">
          <span class="slot-num">0{index + 1}</span>
          {#if isActive}
            <span class="active-indicator" title="Current Single Focus">
              <Zap size={11} strokeWidth={2.5} />
            </span>
          {/if}
        </div>

        <!-- Task Completion Toggle -->
        <button
          type="button"
          class="toggle-btn"
          class:checked={task.done}
          onclick={() => toggleDone(index)}
          aria-label={task.done ? "Mark slot {index + 1} incomplete" : "Mark slot {index + 1} complete"}
        >
          {#if task.done}
            <Check size={13} strokeWidth={3} />
          {/if}
        </button>

        <!-- Task Description Input -->
        <input
          type="text"
          class="task-input"
          placeholder="Task #{index + 1}..."
          bind:value={task.text}
        />

        <!-- Reorder Actions -->
        <div class="slot-actions" data-slop-export="hide">
          <button
            type="button"
            class="order-btn"
            disabled={index === 0}
            onclick={() => moveUp(index)}
            aria-label="Move up"
          >
            <ArrowUp size={12} />
          </button>
          <button
            type="button"
            class="order-btn"
            disabled={index === 5}
            onclick={() => moveDown(index)}
            aria-label="Move down"
          >
            <ArrowDown size={12} />
          </button>
        </div>
      </article>
    {/each}
  </section>

  <!-- Footnote & Rollover Transition -->
  <footer class="ledger-footer">
    <textarea
      class="ledger-notes"
      placeholder="Reflections or end-of-day notes..."
      bind:value={store.current.notes}
      rows={2}
    ></textarea>

    <div class="footer-actions" data-slop-export="hide">
      <button
        type="button"
        class="rollover-btn"
        onclick={rollover}
        title="Carry over incomplete tasks to tomorrow's fresh docket"
      >
        <RotateCcw size={13} />
        <span>Roll Over Unfinished to Tomorrow</span>
      </button>
    </div>
  </footer>
</main>

{#if capture.isRenderer()}
  <Icon />
{/if}
