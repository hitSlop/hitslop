<script lang="ts">
  import { capture } from "@hitslop/runtime";
  import { jsonStore } from "@hitslop/svelte";
  import Check from "@lucide/svelte/icons/check";
  import Plus from "@lucide/svelte/icons/plus";
  import Trash2 from "@lucide/svelte/icons/trash-2";
  import ArrowRight from "@lucide/svelte/icons/arrow-right";
  import CornerDownRight from "@lucide/svelte/icons/corner-down-right";
  import Icon from "./Icon.svelte";

  type Task = { id: string; text: string; done: boolean };
  type QuadrantKey = "q1" | "q2" | "q3" | "q4";

  type MatrixData = {
    title: string;
    date: string;
    q1: Task[];
    q2: Task[];
    q3: Task[];
    q4: Task[];
    inbox: Task[];
  };

  const QUADRANTS: { key: QuadrantKey; num: string; title: string; subtitle: string; tag: string }[] = [
    { key: "q1", num: "I", title: "Do First", subtitle: "Urgent & Important", tag: "Crises & Deadlines" },
    { key: "q2", num: "II", title: "Schedule", subtitle: "Not Urgent & Important", tag: "Focus & Leverage" },
    { key: "q3", num: "III", title: "Delegate", subtitle: "Urgent & Not Important", tag: "Interruptions" },
    { key: "q4", num: "IV", title: "Don’t Do", subtitle: "Not Urgent & Not Important", tag: "Eliminate" },
  ];

  function uid(): string {
    return Math.random().toString(36).slice(2, 9);
  }

  function todayStr(): string {
    const d = new Date();
    return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" });
  }

  const store = jsonStore<MatrixData>({
    title: "Priority Desk Blotter",
    date: todayStr(),
    q1: [
      { id: "q1-1", text: "Submit quarterly tax return", done: false },
      { id: "q1-2", text: "Patch payment webhook failure", done: true },
    ],
    q2: [
      { id: "q2-1", text: "Draft engineering roadmap for v2", done: false },
      { id: "q2-2", text: "Weekly deep-work reading (45 min)", done: false },
      { id: "q2-3", text: "Strength training session", done: true },
    ],
    q3: [
      { id: "q3-1", text: "Reply to inbound vendor cold emails", done: false },
      { id: "q3-2", text: "Reschedule dentist booking", done: false },
    ],
    q4: [
      { id: "q4-1", text: "Audit abandoned Slack channels", done: false },
    ],
    inbox: [
      { id: "ib-1", text: "Review server disk space alert", done: false },
    ],
  });

  let newInboxText = $state("");
  let newQuadText = $state<Record<QuadrantKey, string>>({ q1: "", q2: "", q3: "", q4: "" });

  const totalActive = $derived(
    store.current.q1.filter((t) => !t.done).length +
    store.current.q2.filter((t) => !t.done).length +
    store.current.q3.filter((t) => !t.done).length +
    store.current.q4.filter((t) => !t.done).length +
    store.current.inbox.filter((t) => !t.done).length
  );

  const q2Active = $derived(store.current.q2.filter((t) => !t.done).length);
  const q2Ratio = $derived(totalActive > 0 ? Math.round((q2Active / totalActive) * 100) : 0);

  function addTask(quad: QuadrantKey) {
    const text = newQuadText[quad].trim();
    if (!text) return;
    store.current[quad] = [...store.current[quad], { id: uid(), text, done: false }];
    newQuadText[quad] = "";
  }

  function addInboxTask() {
    const text = newInboxText.trim();
    if (!text) return;
    store.current.inbox = [...store.current.inbox, { id: uid(), text, done: false }];
    newInboxText = "";
  }

  function toggleTask(quad: QuadrantKey | "inbox", id: string) {
    store.current[quad] = store.current[quad].map((t) =>
      t.id === id ? { ...t, done: !t.done } : t
    );
  }

  function deleteTask(quad: QuadrantKey | "inbox", id: string) {
    store.current[quad] = store.current[quad].filter((t) => t.id !== id);
  }

  function moveTask(from: QuadrantKey | "inbox", to: QuadrantKey, id: string) {
    const task = store.current[from].find((t) => t.id === id);
    if (!task) return;
    store.current[from] = store.current[from].filter((t) => t.id !== id);
    store.current[to] = [...store.current[to], task];
  }
</script>

<main class="blotter-container">
  <!-- Header Sheet Strip -->
  <header class="sheet-header">
    <div class="title-group">
      <input
        type="text"
        class="doc-title"
        bind:value={store.current.title}
        aria-label="Document Title"
      />
      <input
        type="text"
        class="doc-date"
        bind:value={store.current.date}
        aria-label="Document Date"
      />
    </div>

    <div class="header-stats" data-slop-export="hide">
      <div class="stat-pill" title="Stephen Covey principle: Aim for >50% of energy in Q2 (Strategic & Preventative)">
        <span class="stat-label">Q2 Leverage</span>
        <span class="stat-value">{q2Ratio}%</span>
      </div>
      <div class="stat-pill">
        <span class="stat-label">Active</span>
        <span class="stat-value">{totalActive}</span>
      </div>
    </div>
  </header>

  <!-- Axis Labels (Tactile Sheet Framing) -->
  <div class="axis-horizontal-header">
    <span class="axis-title-left">◀ URGENT</span>
    <span class="axis-title-right">NOT URGENT ▶</span>
  </div>

  <!-- The 2x2 Matrix Core -->
  <div class="matrix-grid">
    {#each QUADRANTS as q (q.key)}
      <section class="quadrant-card quadrant-{q.key}">
        <div class="quad-header">
          <div class="quad-badge">
            <span class="quad-roman">{q.num}</span>
            <div class="quad-text">
              <h2 class="quad-title">{q.title}</h2>
              <span class="quad-sub">{q.subtitle}</span>
            </div>
          </div>
          <span class="quad-tag">{q.tag}</span>
        </div>

        <ul class="task-list" aria-label="{q.title} tasks">
          {#each store.current[q.key] as task (task.id)}
            <li class="task-item" class:is-done={task.done}>
              <button
                type="button"
                class="check-button"
                class:checked={task.done}
                onclick={() => toggleTask(q.key, task.id)}
                aria-label={task.done ? "Mark incomplete" : "Mark complete"}
              >
                {#if task.done}
                  <Check size={12} strokeWidth={3} />
                {/if}
              </button>

              <input
                type="text"
                class="task-text"
                bind:value={task.text}
                aria-label="Task description"
              />

              <div class="item-actions" data-slop-export="hide">
                <div class="quad-move-selector">
                  {#each QUADRANTS as target}
                    {#if target.key !== q.key}
                      <button
                        type="button"
                        class="move-btn move-{target.key}"
                        title="Move to {target.title} ({target.num})"
                        onclick={() => moveTask(q.key, target.key, task.id)}
                      >
                        {target.num}
                      </button>
                    {/if}
                  {/each}
                </div>

                <button
                  type="button"
                  class="action-btn delete-btn"
                  title="Delete task"
                  onclick={() => deleteTask(q.key, task.id)}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </li>
          {/each}
        </ul>

        <!-- Inline Add Form -->
        <form
          class="add-form"
          data-slop-export="hide"
          onsubmit={(e) => { e.preventDefault(); addTask(q.key); }}
        >
          <input
            type="text"
            class="add-input"
            placeholder="Add to {q.title}..."
            bind:value={newQuadText[q.key]}
          />
          <button type="submit" class="add-submit" aria-label="Add item">
            <Plus size={14} />
          </button>
        </form>
      </section>
    {/each}
  </div>

  <!-- Bottom Triage Holding Pen (Inbox) -->
  <footer class="holding-tray">
    <div class="tray-header">
      <div class="tray-title-group">
        <CornerDownRight size={14} class="tray-icon" />
        <h3 class="tray-heading">Triage Holding Pen</h3>
        <span class="tray-hint">Capture raw tasks, then dispatch into I, II, III, or IV</span>
      </div>
      <span class="tray-count">{store.current.inbox.length} pending</span>
    </div>

    {#if store.current.inbox.length > 0}
      <ul class="inbox-list">
        {#each store.current.inbox as item (item.id)}
          <li class="inbox-item">
            <input
              type="text"
              class="inbox-text"
              bind:value={item.text}
              aria-label="Inbox task"
            />
            <div class="dispatch-group" data-slop-export="hide">
              <span class="dispatch-label">Send to:</span>
              <button
                type="button"
                class="dispatch-btn q1-btn"
                onclick={() => moveTask("inbox", "q1", item.id)}
              >
                I: Do
              </button>
              <button
                type="button"
                class="dispatch-btn q2-btn"
                onclick={() => moveTask("inbox", "q2", item.id)}
              >
                II: Schedule
              </button>
              <button
                type="button"
                class="dispatch-btn q3-btn"
                onclick={() => moveTask("inbox", "q3", item.id)}
              >
                III: Delegate
              </button>
              <button
                type="button"
                class="dispatch-btn q4-btn"
                onclick={() => moveTask("inbox", "q4", item.id)}
              >
                IV: Don’t Do
              </button>
              <button
                type="button"
                class="action-btn delete-btn"
                title="Remove item"
                onclick={() => deleteTask("inbox", item.id)}
              >
                <Trash2 size={13} />
              </button>
            </div>
          </li>
        {/each}
      </ul>
    {/if}

    <form
      class="inbox-form"
      data-slop-export="hide"
      onsubmit={(e) => { e.preventDefault(); addInboxTask(); }}
    >
      <input
        type="text"
        class="inbox-input"
        placeholder="Quick capture a new task..."
        bind:value={newInboxText}
      />
      <button type="submit" class="inbox-submit" aria-label="Add to inbox">
        <Plus size={14} />
      </button>
    </form>
  </footer>
</main>

{#if capture.isRenderer()}
  <Icon />
{/if}
