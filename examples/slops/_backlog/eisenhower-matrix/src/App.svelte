<script lang="ts">
  import { ready } from "@hitslop/runtime";
  import { jsonStore, IconTarget, ExportTarget } from "@hitslop/svelte";
  import { onDestroy } from "svelte";
  import { prefersReducedMotion } from "svelte/motion";
  import { flip } from "svelte/animate";
  import { crossfade } from "svelte/transition";
  import { Checkbox, Dialog, Button, RadioGroup, Tooltip } from "bits-ui";
  import Check from "@lucide/svelte/icons/check";
  import Plus from "@lucide/svelte/icons/plus";
  import Trash2 from "@lucide/svelte/icons/trash-2";
  import X from "@lucide/svelte/icons/x";
  import matrixSchema from "../schema";
  import Icon from "./Icon.svelte";
  import Export from "./Export.svelte";
  import * as s from "./styles.css";

  type QuadrantKey = "q1" | "q2" | "q3" | "q4";
  type Zone = QuadrantKey | "inbox";

  const QUADRANTS: { key: QuadrantKey; num: string; title: string; subtitle: string; tag: string; empty: string }[] = [
    { key: "q1", num: "I", title: "Do First", subtitle: "Urgent & Important", tag: "Crises & Deadlines", empty: "No fires on the blotter." },
    { key: "q2", num: "II", title: "Schedule", subtitle: "Not Urgent & Important", tag: "Focus & Leverage", empty: "Nothing to grow yet." },
    { key: "q3", num: "III", title: "Delegate", subtitle: "Urgent & Not Important", tag: "Interruptions", empty: "Nothing to hand off." },
    { key: "q4", num: "IV", title: "Don’t Do", subtitle: "Not Urgent & Not Important", tag: "Eliminate", empty: "Nothing to drop." },
  ];
  const ZONES: { key: Zone; num: string; label: string }[] = [
    ...QUADRANTS.map(q => ({ key: q.key as Zone, num: q.num, label: q.title })),
    { key: "inbox", num: "IN", label: "Holding pen" },
  ];

  function todayStr(): string {
    return new Date().toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
  }
  function isQuadrant(value: string): value is QuadrantKey {
    return value === "q1" || value === "q2" || value === "q3" || value === "q4";
  }
  function isZone(value: string): value is Zone {
    return value === "inbox" || isQuadrant(value);
  }

  const doc = jsonStore({ schema: matrixSchema, initial: {
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
  } });

  let inboxDraft = $state("");
  let inboxRef = $state<HTMLInputElement>();
  let captureOpen = $state(false);
  let captureText = $state("");
  let captureDest = $state<Zone>("inbox");
  $effect(() => { if (doc.isReady) ready(); });
  onDestroy(() => doc.destroy());

  const totalActive = $derived(
    doc.current.q1.filter(t => !t.done).length +
    doc.current.q2.filter(t => !t.done).length +
    doc.current.q3.filter(t => !t.done).length +
    doc.current.q4.filter(t => !t.done).length +
    doc.current.inbox.filter(t => !t.done).length,
  );
  const q2Active = $derived(doc.current.q2.filter(t => !t.done).length);
  const q2Ratio = $derived(totalActive > 0 ? Math.round((q2Active / totalActive) * 100) : 0);
  const filled = $derived({
    q1: doc.current.q1.some(t => !t.done),
    q2: doc.current.q2.some(t => !t.done),
    q3: doc.current.q3.some(t => !t.done),
    q4: doc.current.q4.some(t => !t.done),
  });
  const flipMs = $derived(prefersReducedMotion.current ? 0 : 220);
  const [send, receive] = crossfade({ duration: () => prefersReducedMotion.current ? 0 : 220 });

  function addInbox() {
    const text = inboxDraft.trim();
    if (!text || doc.isLoading) return;
    doc.current.inbox = [...doc.current.inbox, { id: crypto.randomUUID(), text, done: false }];
    inboxDraft = "";
    inboxRef?.focus();
  }
  function openCapture(dest: Zone = "inbox") {
    captureDest = dest;
    captureText = "";
    captureOpen = true;
  }
  function submitCapture() {
    const text = captureText.trim();
    if (!text || doc.isLoading) return;
    doc.current[captureDest] = [...doc.current[captureDest], { id: crypto.randomUUID(), text, done: false }];
    captureText = "";
    captureOpen = false;
  }
  function deleteTask(zone: Zone, id: string) {
    doc.current[zone] = doc.current[zone].filter(task => task.id !== id);
  }
  function moveTask(from: Zone, to: QuadrantKey, id: string) {
    if (from === to) return;
    const task = doc.current[from].find(item => item.id === id);
    if (!task) return;
    doc.current[from] = doc.current[from].filter(item => item.id !== id);
    doc.current[to] = [...doc.current[to], task];
  }
  function destinations(from: Zone) {
    return QUADRANTS.filter(q => q.key !== from);
  }
</script>

<Tooltip.Provider>
<main class={s.canvas} data-slop-selection="none" aria-busy={doc.isLoading} aria-label="Eisenhower matrix blotter">
  <article class={s.blotter} inert={!doc.isReady || doc.isLoading}>
    <header class={s.letterhead}>
      <div class={s.titleGroup}>
        <input class={s.title} aria-label="Blotter title" bind:value={doc.current.title} placeholder="Priority Desk Blotter" />
        <input class={s.date} aria-label="Blotter date" bind:value={doc.current.date} />
      </div>
      <Tooltip.Root>
        <Tooltip.Trigger class={s.leverage} aria-label="Q2 leverage {q2Ratio} percent">
          <span class={s.leverageRow}>
            <span>Q2 Leverage</span>
            <span class={s.leverageValue}>{q2Ratio}%</span>
          </span>
          <span class={s.meter} aria-hidden="true"><span class={s.meterFill} style:width="{q2Ratio}%"></span></span>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content class={s.tooltip} sideOffset={6}>Aim for more than half of open work in Schedule (Q2).</Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
      <span class={s.activeCount}>{totalActive} open</span>
    </header>

    <div class={s.axis} aria-hidden="true">
      <span>◀ Urgent</span>
      <span>Not urgent ▶</span>
    </div>

    <div class={s.matrix}>
      {#each QUADRANTS as q (q.key)}
        <section class={s.quadrant} data-quad={q.key} aria-label="{q.title} tasks">
          <div class={s.quadHeader}>
            <div class={s.quadBadge}>
              <span class={s.roman} data-quad={q.key}>{q.num}</span>
              <div class={s.quadText}>
                <h2 class={s.quadTitle}>{q.title}</h2>
                <span class={s.quadSub}>{q.subtitle}</span>
              </div>
            </div>
            <span class={s.quadTag}>{q.tag}</span>
            <Button.Root class={s.quadAdd} data-slop-export="hide" aria-label="Place a task in {q.title}" onclick={() => openCapture(q.key)} disabled={doc.isLoading}>
              <Plus size={13} strokeWidth={2.2} />
            </Button.Root>
          </div>
          <ul class={s.list}>
            {#each doc.current[q.key] as task (task.id)}
              <li
                class={s.row}
                data-done={task.done}
                in:receive={{ key: task.id }}
                out:send={{ key: task.id }}
                animate:flip={{ duration: flipMs }}
              >
                <Checkbox.Root checked={task.done} onCheckedChange={checked => { task.done = checked === true; }} aria-label={`Mark ${task.text || "untitled task"} ${task.done ? "open" : "done"}`}>
                  {#snippet children({ checked })}{#if checked}<Check size={12} strokeWidth={3} />{/if}{/snippet}
                </Checkbox.Root>
                <input class={s.taskText} aria-label="{q.title} task" bind:value={task.text} />
                <div class={s.actions} data-slop-export="hide">
                  <div class={s.stamps}>
                    {#each destinations(q.key) as target}
                      <button type="button" class={s.stamp} data-quad={target.key} title="Move to {target.title} ({target.num})" aria-label="Move to {target.title}" onclick={() => moveTask(q.key, target.key, task.id)}>{target.num}</button>
                    {/each}
                  </div>
                  <button type="button" class={s.remove} aria-label="Delete {task.text || "untitled task"}" onclick={() => deleteTask(q.key, task.id)}><Trash2 size={13} /></button>
                </div>
              </li>
            {:else}
              <li class={s.empty}>{q.empty}</li>
            {/each}
          </ul>
        </section>
      {/each}
    </div>

    <footer class={s.tray}>
      <div class={s.trayHead}>
        <div class={s.trayTitle}>
          <h3 class={s.trayHeading}>Holding Pen</h3>
          <span class={s.trayHint}>Capture first, then stamp into I–IV</span>
        </div>
        <span class={s.trayCount}>{doc.current.inbox.length} parked</span>
      </div>
      {#if doc.current.inbox.length > 0}
        <ul class={s.trayList} aria-label="Holding pen">
          {#each doc.current.inbox as item (item.id)}
            <li
              class={s.inboxRow}
              in:receive={{ key: item.id }}
              out:send={{ key: item.id }}
              animate:flip={{ duration: flipMs }}
            >
              <input class={s.taskText} aria-label="Inbox task" bind:value={item.text} />
              <div class={s.dispatch} data-slop-export="hide">
                <span class={s.dispatchLabel}>Stamp</span>
                {#each QUADRANTS as target}
                  <button type="button" class={s.stamp} data-quad={target.key} title="Send to {target.title} ({target.num})" aria-label="Send to {target.title}" onclick={() => moveTask("inbox", target.key, item.id)}>{target.num}</button>
                {/each}
                <button type="button" class={s.remove} aria-label="Remove {item.text || "untitled task"}" onclick={() => deleteTask("inbox", item.id)}><Trash2 size={13} /></button>
              </div>
            </li>
          {/each}
        </ul>
      {/if}
      <form class={s.composer} data-slop-export="hide" onsubmit={event => { event.preventDefault(); addInbox(); }}>
        <input
          bind:this={inboxRef}
          class={s.composerInput}
          bind:value={inboxDraft}
          aria-label="Quick capture a new task"
          placeholder="Quick capture a new task…"
          disabled={doc.isLoading}
        />
        <Button.Root class={s.place} type="button" onclick={() => openCapture("inbox")} disabled={doc.isLoading}>Place</Button.Root>
        <Button.Root class={s.add} type="submit" aria-label="Add to holding pen" disabled={!inboxDraft.trim() || doc.isLoading}><Plus size={16} /></Button.Root>
      </form>
    </footer>
  </article>

  {#if doc.error}
    <div class={s.error} role="alert">
      <span>{doc.isReady ? "Changes haven’t been saved." : "The blotter couldn’t be loaded."} {doc.error}</span>
      <button data-slop-export="hide" onclick={() => { if (doc.isReady) void doc.flush().catch(() => undefined); else void doc.reload(); }}>Try again</button>
    </div>
  {:else if doc.isLoading}<p class={s.error} role="status">Loading the blotter…</p>{/if}
</main>

<Dialog.Root bind:open={captureOpen}>
  <Dialog.Portal>
    <Dialog.Overlay class={s.overlay} data-slop-export="hide" />
    <Dialog.Content class={s.dialog} aria-labelledby="capture-title" data-slop-export="hide">
      <div class={s.dialogHead}>
        <Dialog.Title id="capture-title">Place on the blotter</Dialog.Title>
        <Dialog.Close class={s.dialogClose} aria-label="Close capture"><X size={16} /></Dialog.Close>
      </div>
      <form class={s.dialogForm} onsubmit={event => { event.preventDefault(); submitCapture(); }}>
        <label class={s.dialogField}>
          <span>Task</span>
          <input bind:value={captureText} aria-label="Task to place" placeholder="What needs a square?" required disabled={doc.isLoading} />
        </label>
        <div class={s.dialogField}>
          <span>Square</span>
          <RadioGroup.Root class={s.destGroup} orientation="horizontal" value={captureDest} onValueChange={value => { if (isZone(value)) captureDest = value; }} aria-label="Destination square">
            {#each ZONES as zone (zone.key)}
              <RadioGroup.Item value={zone.key} class={s.dest} data-quad={zone.key} aria-label={zone.label}>{zone.num}</RadioGroup.Item>
            {/each}
          </RadioGroup.Root>
        </div>
        <div class={s.dialogActions}>
          <Button.Root class={s.dialogCancel} type="button" onclick={() => { captureOpen = false; }}>Cancel</Button.Root>
          <Button.Root class={s.dialogSubmit} type="submit" disabled={!captureText.trim() || doc.isLoading}>Place</Button.Root>
        </div>
      </form>
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>

<IconTarget><Icon filled={filled} ratio={q2Ratio} /></IconTarget>
<ExportTarget><Export data={doc.current} ratio={q2Ratio} active={totalActive} /></ExportTarget>
</Tooltip.Provider>
