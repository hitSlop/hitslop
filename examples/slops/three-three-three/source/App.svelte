<script lang="ts">
  import { capture } from "@hitslop/runtime";
  import { jsonStore } from "@hitslop/svelte";
  import Check from "@lucide/svelte/icons/check";
  import Clock from "@lucide/svelte/icons/clock";
  import Sparkles from "@lucide/svelte/icons/sparkles";
  import Wrench from "@lucide/svelte/icons/wrench";
  import Plus from "@lucide/svelte/icons/plus";
  import Minus from "@lucide/svelte/icons/minus";
  import Icon from "./Icon.svelte";

  type TaskItem = { text: string; done: boolean };

  type ThreeThreeThreeData = {
    date: string;
    deepWork: {
      project: string;
      minutes: number; // 0..180
      notes: string;
    };
    shortTasks: [TaskItem, TaskItem, TaskItem];
    maintenance: [TaskItem, TaskItem, TaskItem];
  };

  function todayStr(): string {
    const d = new Date();
    return d.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
  }

  const store = jsonStore<ThreeThreeThreeData>({
    date: todayStr(),
    deepWork: {
      project: "Chapter 4 draft: The Economics of Attention",
      minutes: 90,
      notes: "Focus solely on outlining section 4.2 before touching citations. Zero tabs open.",
    },
    shortTasks: [
      { text: "Call accountant regarding quarterly filing", done: false },
      { text: "Confirm venue contract for October offsite", done: true },
      { text: "Send revised proposal to client", done: false },
    ],
    maintenance: [
      { text: "Inbox down to zero unprocessed emails", done: true },
      { text: "45-minute zone 2 run or walk", done: false },
      { text: "Backup local development databases", done: false },
    ],
  });

  const hoursLogged = $derived(Math.floor(store.current.deepWork.minutes / 60));
  const minsRemainder = $derived(store.current.deepWork.minutes % 60);
  const deepPct = $derived(Math.min(100, Math.round((store.current.deepWork.minutes / 180) * 100)));

  const shortDoneCount = $derived(store.current.shortTasks.filter((t) => t.done).length);
  const maintDoneCount = $derived(store.current.maintenance.filter((t) => t.done).length);
  const totalTasksDone = $derived(shortDoneCount + maintDoneCount);

  function adjustMinutes(delta: number) {
    const next = Math.max(0, Math.min(180, store.current.deepWork.minutes + delta));
    store.current.deepWork.minutes = next;
  }

  function setHourDirect(hour: number) {
    const targetMins = hour * 60;
    if (store.current.deepWork.minutes === targetMins) {
      store.current.deepWork.minutes = (hour - 1) * 60;
    } else {
      store.current.deepWork.minutes = targetMins;
    }
  }

  function toggleShort(idx: number) {
    store.current.shortTasks[idx].done = !store.current.shortTasks[idx].done;
  }

  function toggleMaint(idx: number) {
    store.current.maintenance[idx].done = !store.current.maintenance[idx].done;
  }
</script>

<main class="plan-container">
  <!-- Sheet Header -->
  <header class="sheet-header">
    <div class="header-top">
      <span class="philosophy-badge">OLIVER BURKEMAN • FINITE DAY DOCKET</span>
      <div class="stats-pills" data-slop-export="hide">
        <span class="pill">
          {hoursLogged}h {minsRemainder}m / 3h Focus
        </span>
        <span class="pill">
          {totalTasksDone}/6 Tasks Done
        </span>
      </div>
    </div>

    <div class="header-main">
      <h1 class="plan-title">The 3-3-3 Plan</h1>
      <input
        type="text"
        class="plan-date"
        bind:value={store.current.date}
        aria-label="Plan Date"
      />
    </div>
  </header>

  <!-- BAND 1: 3 Hours of Deep Work -->
  <section class="section-card deep-work-card">
    <div class="card-header">
      <div class="card-label">
        <span class="num-badge deep-num">3</span>
        <div class="label-copy">
          <h2 class="card-title">Hours of Deep Work</h2>
          <span class="card-subtitle">One core, challenging project with zero distraction</span>
        </div>
      </div>

      <!-- Live Dial / Stepper -->
      <div class="time-controls" data-slop-export="hide">
        <button
          type="button"
          class="stepper-btn"
          onclick={() => adjustMinutes(-15)}
          title="Subtract 15 min"
          aria-label="Subtract 15 min"
        >
          <Minus size={12} />
        </button>

        <span class="time-readout">
          {hoursLogged}h {String(minsRemainder).padStart(2, "0")}m
        </span>

        <button
          type="button"
          class="stepper-btn"
          onclick={() => adjustMinutes(15)}
          title="Add 15 min"
          aria-label="Add 15 min"
        >
          <Plus size={12} />
        </button>
      </div>
    </div>

    <!-- 3-Hour Visual Segment Bar -->
    <div class="hour-segments">
      {#each [1, 2, 3] as h}
        {@const filled = store.current.deepWork.minutes >= h * 60}
        {@const partial = !filled && store.current.deepWork.minutes > (h - 1) * 60}
        <button
          type="button"
          class="hour-block"
          class:is-filled={filled}
          class:is-partial={partial}
          onclick={() => setHourDirect(h)}
          title="Toggle Hour {h}"
        >
          <Clock size={11} />
          <span>Hour 0{h}</span>
          {#if filled}
            <span class="block-check"><Check size={10} strokeWidth={3} /></span>
          {/if}
        </button>
      {/each}
    </div>

    <input
      type="text"
      class="project-input"
      placeholder="Name the single deep-work project..."
      bind:value={store.current.deepWork.project}
      aria-label="Deep work project title"
    />

    <textarea
      class="project-notes"
      placeholder="Session goals, scope boundaries, or breakthrough notes..."
      bind:value={store.current.deepWork.notes}
      rows={2}
    ></textarea>
  </section>

  <!-- BAND 2: 3 Shorter Urgent Tasks -->
  <section class="section-card short-card">
    <div class="card-header">
      <div class="card-label">
        <span class="num-badge short-num">3</span>
        <div class="label-copy">
          <h2 class="card-title">Urgent / Shorter Tasks</h2>
          <span class="card-subtitle">Tasks you have been avoiding or pressing obligations</span>
        </div>
      </div>
      <span class="card-count">{shortDoneCount}/3</span>
    </div>

    <ul class="task-list">
      {#each store.current.shortTasks as task, idx (idx)}
        <li class="task-item" class:is-done={task.done}>
          <button
            type="button"
            class="check-btn"
            class:checked={task.done}
            onclick={() => toggleShort(idx)}
            aria-label={task.done ? "Mark task incomplete" : "Mark task complete"}
          >
            {#if task.done}
              <Check size={12} strokeWidth={3} />
            {/if}
          </button>
          <span class="item-index">#{idx + 1}</span>
          <input
            type="text"
            class="task-input"
            placeholder="Short pressing task #{idx + 1}..."
            bind:value={task.text}
          />
        </li>
      {/each}
    </ul>
  </section>

  <!-- BAND 3: 3 Maintenance Activities -->
  <section class="section-card maint-card">
    <div class="card-header">
      <div class="card-label">
        <span class="num-badge maint-num">3</span>
        <div class="label-copy">
          <h2 class="card-title">Maintenance Activities</h2>
          <span class="card-subtitle">Routines, admin, health, and household loops to keep life running</span>
        </div>
      </div>
      <span class="card-count">{maintDoneCount}/3</span>
    </div>

    <ul class="task-list">
      {#each store.current.maintenance as item, idx (idx)}
        <li class="task-item" class:is-done={item.done}>
          <button
            type="button"
            class="check-btn"
            class:checked={item.done}
            onclick={() => toggleMaint(idx)}
            aria-label={item.done ? "Mark activity incomplete" : "Mark activity complete"}
          >
            {#if item.done}
              <Check size={12} strokeWidth={3} />
            {/if}
          </button>
          <span class="item-index">#{idx + 1}</span>
          <input
            type="text"
            class="task-input"
            placeholder="Maintenance loop #{idx + 1}..."
            bind:value={item.text}
          />
        </li>
      {/each}
    </ul>
  </section>
</main>

{#if capture.isRenderer()}
  <Icon />
{/if}
