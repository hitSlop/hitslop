<script lang="ts">
  import { capture } from "@hitslop/runtime";
  import { jsonStore } from "@hitslop/svelte";
  import Check from "@lucide/svelte/icons/check";
  import Plus from "@lucide/svelte/icons/plus";
  import Trash2 from "@lucide/svelte/icons/trash-2";
  import { Checkbox } from "bits-ui";
  import Icon from "./Icon.svelte";

  type Task = {
    id: string;
    time: string;
    title: string;
    done: boolean;
  };

  type DayName = "MON" | "TUE" | "WED" | "THU" | "FRI";

  type PlannerData = {
    week: string;
    focus: string;
    days: Record<DayName, Task[]>;
  };

  const DAYS: DayName[] = ["MON", "TUE", "WED", "THU", "FRI"];

  const doc = jsonStore<PlannerData>({
    week: "Week of Oct 12 — 18",
    focus: "Ship the v2 release & celebrate.",
    days: {
      MON: [
        { id: "1", time: "09:00", title: "Team sync", done: true },
        { id: "2", time: "14:00", title: "Design review", done: true },
      ],
      TUE: [
        { id: "3", time: "10:30", title: "Customer interview", done: true },
        { id: "4", time: "15:00", title: "API integration", done: false },
      ],
      WED: [
        { id: "5", time: "09:00", title: "Refactor models", done: false },
        { id: "6", time: "13:30", title: "Run test suite", done: false },
      ],
      THU: [
        { id: "7", time: "11:00", title: "Staging deploy", done: false },
        { id: "8", time: "16:00", title: "QA pass", done: false },
      ],
      FRI: [
        { id: "9", time: "10:00", title: "Production launch", done: false },
        { id: "10", time: "17:00", title: "Team demo & toast", done: false },
      ],
    },
  });

  const allTasks = $derived(
    Object.values(doc.current.days).flat()
  );
  const doneCount = $derived(allTasks.filter((t) => t.done).length);
  const totalCount = $derived(allTasks.length);

  function addTask(day: DayName) {
    doc.current.days[day].push({
      id: crypto.randomUUID(),
      time: "12:00",
      title: "New appointment",
      done: false,
    });
  }

  function removeTask(day: DayName, id: string) {
    doc.current.days[day] = doc.current.days[day].filter((t) => t.id !== id);
  }
</script>

<main class="planner-canvas">
  <article class="planner-pad">
    <!-- Header -->
    <header class="planner-header">
      <input
        class="week-title-input"
        aria-label="Week title"
        bind:value={doc.current.week}
      />
      <div class="focus-banner">
        <span>FOCUS:</span>
        <input
          class="focus-input"
          aria-label="Weekly focus"
          bind:value={doc.current.focus}
        />
      </div>
    </header>

    <!-- 5-Day Columns Grid -->
    <section class="days-grid" aria-label="Weekly days grid">
      {#each DAYS as day}
        <div class="day-column">
          <div class="day-header">
            <span class="day-name">{day}</span>
            <button
              type="button"
              class="add-task-btn"
              data-slop-export="hide"
              aria-label="Add task to {day}"
              onclick={() => addTask(day)}
            >
              <Plus size={13} />
            </button>
          </div>

          <ul class="tasks-list">
            {#each doc.current.days[day] as task (task.id)}
              <li class="task-card" class:done={task.done}>
                <Checkbox.Root
                  checked={task.done}
                  onCheckedChange={(c) => { task.done = !!c; }}
                  class="task-check"
                  aria-label="Mark {task.title} complete"
                >
                  {#snippet children({ checked })}
                    {#if checked}
                      <Check size={10} strokeWidth={3} />
                    {/if}
                  {/snippet}
                </Checkbox.Root>
                <div class="task-content">
                  <input
                    class="task-time-input"
                    aria-label="Task time"
                    bind:value={task.time}
                  />
                  <input
                    class="task-title-input"
                    aria-label="Task title"
                    bind:value={task.title}
                  />
                </div>
                <button
                  type="button"
                  class="task-delete-btn"
                  data-slop-export="hide"
                  aria-label="Delete {task.title}"
                  onclick={() => removeTask(day, task.id)}
                >
                  <Trash2 size={11} />
                </button>
              </li>
            {/each}
          </ul>
        </div>
      {/each}
    </section>

    <!-- Footer Summary -->
    <footer class="planner-footer">
      <span>{doneCount} of {totalCount} weekly tasks completed</span>
      <span>HITSLOP DESK BLOTTER SERIES</span>
    </footer>
  </article>
</main>

{#if capture.isRenderer()}
  <Icon />
{/if}
