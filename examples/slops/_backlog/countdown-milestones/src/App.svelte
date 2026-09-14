<script lang="ts">
  import { ready } from "@hitslop/runtime";
  import { jsonStore, IconTarget, ExportTarget } from "@hitslop/svelte";
  import { Checkbox, Dialog, Progress } from "bits-ui";
  import { onMount, onDestroy } from "svelte";
  import schema from "../schema";
  import { isoDate, parseTarget, countdownState } from "./countdown";
  import CountdownFace from "./CountdownFace.svelte";
  import DatePicker from "./DatePicker.svelte";
  import Export from "./Export.svelte";
  import Icon from "./Icon.svelte";
  import { grow } from "./grow";
  import * as s from "./styles.css";
  const today = new Date();
  const target = new Date(today.getFullYear(), today.getMonth() + 3, 12);
  const doc = jsonStore({
    schema,
    initial: {
      title: "The big trip",
      createdAt: isoDate(today),
      targetDate: isoDate(target),
      targetTime: "09:00",
      milestones: [
        { id: "book", title: "Book the stay", done: false },
        { id: "plan", title: "Plan a few adventures", done: false },
        { id: "pack", title: "Pack the essentials", done: false },
      ],
    },
  });
  let now = $state(Date.now());
  const view = $derived(
    countdownState(doc.current.targetDate, doc.current.targetTime, now),
  );
  const completed = $derived(
    doc.current.milestones.filter((m) => m.done).length,
  );
  let editing = $state(false);
  let editingSteps = $state(false);
  let title = $state("");
  let date = $state("");
  let time = $state("");
  let error = $state("");
  let newTitle = $state("");
  $effect(() => {
    if (doc.isReady) ready();
  });
  onMount(() => {
    const update = () => {
      now = Date.now();
    };
    const timer = setInterval(update, 1000);
    document.addEventListener("visibilitychange", update);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", update);
    };
  });
  onDestroy(() => doc.destroy());
  function edit() {
    title = doc.current.title;
    date = doc.current.targetDate;
    time = doc.current.targetTime;
    error = "";
    editing = true;
  }
  function save() {
    if (!title.trim()) {
      error = "Give your event a name.";
      return;
    }
    if (!parseTarget(date, time)) {
      error = "Choose a valid date and local time.";
      return;
    }
    doc.current.title = title.trim();
    doc.current.targetDate = date;
    doc.current.targetTime = time;
    now = Date.now();
    editing = false;
  }
  function add() {
    if (!newTitle.trim() || doc.current.milestones.length >= 25) return;
    doc.current.milestones.push({
      id: crypto.randomUUID(),
      title: newTitle.trim(),
      done: false,
    });
    newTitle = "";
  }
  function move(index: number, step: number) {
    const next = index + step;
    if (next < 0 || next >= doc.current.milestones.length) return;
    const items = [...doc.current.milestones];
    [items[index], items[next]] = [items[next], items[index]];
    doc.current.milestones = items;
  }
</script>

<main
  class={s.shell}
  aria-label="Countdown and milestones"
  aria-busy={doc.isLoading}
>
  <div inert={!doc.isReady || doc.isLoading}>
    <header class={s.header}>
      <span class={s.eyebrow}>A date to remember</span><button
        class={s.button}
        onclick={edit}>Edit countdown</button
      >
    </header>
    <CountdownFace data={doc.current} state={view} onEdit={edit} />
    <section aria-label="Milestones">
      <div class={s.sectionHead}>
        <h2 class={s.sectionTitle}>Along the way</h2>
        <button
          class={s.smallButton}
          onclick={() => (editingSteps = !editingSteps)}
          aria-pressed={editingSteps}
          >{editingSteps ? "Done editing" : "Edit steps"}</button
        >
      </div>
      <div class={s.progressRow}>
        <span>{completed} of {doc.current.milestones.length} complete</span
        ><Progress.Root
          class={s.track}
          value={completed}
          max={Math.max(1, doc.current.milestones.length)}
          aria-label="Milestone completion"
          ><div
            class={s.fill}
            style:width={`${doc.current.milestones.length ? (completed / doc.current.milestones.length) * 100 : 0}%`}
          ></div></Progress.Root
        >
      </div>
      <ol class={s.list}>
        {#each doc.current.milestones as item, index (item.id)}<li
            class={s.row}
          >
            <Checkbox.Root
              class={s.check}
              bind:checked={item.done}
              aria-label="Complete {item.title || 'milestone'}"
              >{item.done ? "✓" : ""}</Checkbox.Root
            ><textarea
              class={s.milestone}
              data-done={item.done}
              aria-label="Milestone {index + 1} title"
              rows="1"
              bind:value={item.title}
              use:grow={item.title}></textarea>{#if editingSteps}<div
                class={s.tools}
              >
                <button
                  class={s.smallButton}
                  aria-label="Move {item.title} up"
                  disabled={index === 0}
                  onclick={() => move(index, -1)}>↑</button
                ><button
                  class={s.smallButton}
                  aria-label="Move {item.title} down"
                  disabled={index === doc.current.milestones.length - 1}
                  onclick={() => move(index, 1)}>↓</button
                ><button
                  class={s.smallButton}
                  aria-label="Delete {item.title}"
                  onclick={() =>
                    (doc.current.milestones = doc.current.milestones.filter(
                      (m) => m.id !== item.id,
                    ))}>×</button
                >
              </div>{/if}
          </li>{/each}
      </ol>
      {#if !doc.current.milestones.length}<p class={s.empty}>
          Anything to do before the big day? Add your first step.
        </p>{/if}
      <form
        class={s.add}
        onsubmit={(event) => {
          event.preventDefault();
          add();
        }}
      >
        <input
          class={s.addInput}
          bind:value={newTitle}
          maxlength="120"
          placeholder="Add a milestone…"
          aria-label="New milestone"
          disabled={doc.current.milestones.length >= 25}
        /><button
          class={s.addButton}
          type="submit"
          disabled={!newTitle.trim() || doc.current.milestones.length >= 25}
          >+ Add</button
        >
      </form>
      {#if doc.current.milestones.length >= 25}<p class={s.empty}>
          All 25 milestone spaces are filled.
        </p>{/if}
    </section>
  </div>
  {#if doc.error}<p class={s.error} role="alert">
      {doc.isReady
        ? "Your changes haven’t been saved."
        : "This countdown couldn’t be loaded."}
      {doc.error}<button
        onclick={() => {
          if (doc.isReady) void doc.flush().catch(() => undefined);
          else void doc.reload();
        }}>Try again</button
      >
    </p>{:else if doc.isLoading}<p class={s.empty} role="status">
      Opening your countdown…
    </p>{/if}
</main>
<Dialog.Root bind:open={editing}
  ><Dialog.Portal
    ><Dialog.Overlay class={s.overlay} /><Dialog.Content class={s.dialog}
      ><Dialog.Title class={s.dialogTitle}
        >Something to look forward to.</Dialog.Title
      ><Dialog.Description class={s.description}
        >Choose the date and time in your local timezone.</Dialog.Description
      >
      <form
        onsubmit={(event) => {
          event.preventDefault();
          save();
        }}
      >
        <label class={s.field}
          >Event name<input
            class={s.input}
            bind:value={title}
            maxlength="100"
            required
          /></label
        >
        <div class={s.field}>
          <span>Target date</span><DatePicker bind:value={date} />
        </div>
        <label class={s.field}
          >Time<input
            class={s.input}
            type="time"
            bind:value={time}
            required
          /></label
        >{#if error}<p class={s.error} role="alert">{error}</p>{/if}
        <div class={s.actions}>
          <Dialog.Close class={s.button} type="button">Cancel</Dialog.Close
          ><button class={s.save} type="submit">Save countdown</button>
        </div>
      </form></Dialog.Content
    ></Dialog.Portal
  ></Dialog.Root
>
<IconTarget><Icon state={view} /></IconTarget><ExportTarget
  ><Export data={doc.current} state={view} /></ExportTarget
>
