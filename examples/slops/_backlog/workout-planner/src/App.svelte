<script lang="ts">
  import { ready } from "@hitslop/runtime";
  import { jsonStore, IconTarget, ExportTarget } from "@hitslop/svelte";
  import { onDestroy, onMount } from "svelte";
  import { Dialog, AlertDialog, Checkbox, Progress, Select } from "bits-ui";
  import workoutSchema from "../schema";
  import {
    checked,
    sets,
    complete,
    count,
    toggle,
    nextSet,
    nextExercise,
    reset,
    resizeSets,
    formatTime,
    type Exercise,
  } from "./workout";
  import { createRestClock } from "./rest";
  import Icon from "./Icon.svelte";
  import Export from "./Export.svelte";
  import * as s from "./styles.css";
  const PRESETS = [60, 90, 120, 180].map((value) => ({
    value: String(value),
    label: value < 120 ? `${value}s` : `${value / 60}m`,
  }));
  const doc = jsonStore({
    schema: workoutSchema,
    initial: {
      title: "Leg day",
      restPreset: 90,
      exercises: [
        {
          id: "squat",
          name: "Barbell back squat",
          sets: 4,
          reps: 8,
          weight: "225 lbs",
          completedSets: 0,
        },
        {
          id: "rdl",
          name: "Romanian deadlift",
          sets: 4,
          reps: 10,
          weight: "185 lbs",
          completedSets: 0,
        },
        {
          id: "press",
          name: "Leg press",
          sets: 3,
          reps: 12,
          weight: "360 lbs",
          completedSets: 0,
        },
        {
          id: "curl",
          name: "Lying leg curl",
          sets: 3,
          reps: 12,
          weight: "90 lbs",
          completedSets: 0,
        },
        {
          id: "calf",
          name: "Standing calf raise",
          sets: 4,
          reps: 15,
          weight: "140 lbs",
          completedSets: 0,
        },
      ],
    },
  });
  $effect(() => {
    if (doc.isReady) ready();
  });
  const total = $derived(
    doc.current.exercises.reduce((n, ex) => n + sets(ex), 0),
  );
  const done = $derived(
    doc.current.exercises.reduce((n, ex) => n + checked(ex).length, 0),
  );
  const finished = $derived(total > 0 && done === total);
  let selectedId = $state<string | null>(null);
  const active = $derived(
    doc.current.exercises.find(
      (ex) => ex.id === (selectedId ?? nextExercise(doc.current.exercises)),
    ) ??
      doc.current.exercises.find((ex) => !complete(ex)) ??
      doc.current.exercises[0],
  );
  let contentEl: HTMLDivElement;
  let routine = $state(false);
  let reviewCompleted = $state(false);
  let dialogOpen = $state(false);
  let resetOpen = $state(false);
  let draft = $state<Exercise | null>(null);
  let existing = $state(false);
  let formError = $state("");
  let announcement = $state("");
  const rest = createRestClock();
  let restSeconds = $state(0);
  let restTotal = $state(0);
  let restRunning = $state(false);
  let restFor = $state("");
  let pendingAdvance: string | null = null;
  function preset() {
    return doc.current.restPreset > 0
      ? count(doc.current.restPreset, 1, 3600)
      : 90;
  }
  function syncRest() {
    const value = rest.read();
    restSeconds = value.seconds;
    restTotal = value.total;
    if (restRunning && value.seconds === 0) finishRest();
  }
  function finishRest() {
    const advance = pendingAdvance;
    rest.stop();
    restRunning = false;
    restSeconds = 0;
    restTotal = 0;
    pendingAdvance = null;
    if (advance) {
      selectedId = nextExercise(doc.current.exercises, advance);
      if (contentEl) contentEl.scrollTop = 0;
    }
    announcement = "Rest finished. Ready for your next set.";
  }
  function stopRest() {
    rest.stop();
    restRunning = false;
    restSeconds = 0;
    restTotal = 0;
    pendingAdvance = null;
  }
  function startRest(ex?: Exercise) {
    rest.start(preset());
    restRunning = true;
    restFor = ex?.name ?? active?.name ?? "";
    pendingAdvance = ex && complete(ex) ? ex.id : null;
    syncRest();
    announcement = "Rest started.";
  }
  onMount(() => {
    const timer = setInterval(syncRest, 250);
    const visibility = () => {
      if (document.visibilityState === "visible") syncRest();
    };
    document.addEventListener("visibilitychange", visibility);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", visibility);
    };
  });
  onDestroy(() => {
    rest.stop();
    doc.destroy();
  });
  function select(ex: Exercise) {
    selectedId = ex.id;
    pendingAdvance = null;
    reviewCompleted = true;
    if (contentEl) contentEl.scrollTop = 0;
  }
  function toggleSet(ex: Exercise, index: number) {
    const added = toggle(ex, index);
    selectedId = ex.id;
    reviewCompleted = false;
    if (doc.current.exercises.every(complete)) {
      stopRest();
      announcement = "Workout complete.";
    } else if (added) startRest(ex);
    else {
      stopRest();
      announcement = `Set ${index + 1} marked unfinished.`;
    }
  }
  function logSet() {
    if (!active) return;
    const index = nextSet(active);
    if (index !== undefined) toggleSet(active, index);
  }
  function edit(ex?: Exercise) {
    existing = !!ex;
    draft = ex
      ? { ...ex, completedSetIndices: checked(ex) }
      : {
          id: crypto.randomUUID(),
          name: "",
          sets: 3,
          reps: 10,
          weight: "",
          completedSets: 0,
          completedSetIndices: [],
        };
    formError = "";
    dialogOpen = true;
  }
  function saveExercise() {
    if (!draft) return;
    if (!draft.name.trim()) {
      formError = "Give this exercise a name.";
      return;
    }
    if (!Number.isFinite(draft.sets) || !Number.isFinite(draft.reps)) {
      formError = "Enter a set and rep target.";
      return;
    }
    const original = doc.current.exercises.find((ex) => ex.id === draft!.id);
    const next = {
      ...draft,
      name: draft.name.trim(),
      reps: count(draft.reps, 1, 50),
      weight: draft.weight.trim() || "Bodyweight",
    };
    // Resolve completion against the original target before applying a new target.
    if (original) next.completedSetIndices = checked(original);
    resizeSets(next, next.sets);
    if (original) Object.assign(original, next);
    else doc.current.exercises.push(next);
    if (pendingAdvance === next.id && !complete(next)) pendingAdvance = null;
    if (doc.current.exercises.every(complete)) stopRest();
    dialogOpen = false;
  }
  function removeExercise() {
    if (!draft) return;
    doc.current.exercises = doc.current.exercises.filter(
      (ex) => ex.id !== draft!.id,
    );
    if (selectedId === draft.id) selectedId = null;
    stopRest();
    dialogOpen = false;
  }
  function reorder(index: number, step: number) {
    const next = index + step;
    if (next < 0 || next >= doc.current.exercises.length) return;
    const items = [...doc.current.exercises];
    [items[index], items[next]] = [items[next], items[index]];
    doc.current.exercises = items;
  }
  function resetProgress() {
    reset(doc.current.exercises);
    selectedId = null;
    reviewCompleted = false;
    stopRest();
    announcement = "Progress reset. Ready to train.";
    resetOpen = false;
  }
</script>

<main class={s.board} aria-label="Workout planner" aria-busy={doc.isLoading}>
  <header class={s.header} inert={!doc.isReady || doc.isLoading}>
    <div class={s.top}>
      <span class={s.eyebrow}
        >Training / {routine ? "Build your routine" : "One set at a time"}</span
      ><button class={s.button} onclick={() => (routine = !routine)}
        >{routine ? "Back to workout" : "Edit routine"}</button
      >
    </div>
    <div class={s.top}>
      <h1 class={s.title}>{doc.current.title || "Your workout"}</h1>
      <span class={s.fraction}>{done} / {total} sets</span>
    </div>
    <Progress.Root
      class={s.progress}
      value={done}
      max={Math.max(1, total)}
      aria-label="Workout completion"
      ><div
        class={s.fill}
        style:width={`${total ? (done / total) * 100 : 0}%`}
      ></div></Progress.Root
    >
  </header>
  <div
    class={s.content}
    bind:this={contentEl}
    inert={!doc.isReady || doc.isLoading}
  >
    {#if routine}
      <label class={s.field}
        >Workout title<input
          class={s.input}
          bind:value={doc.current.title}
        /></label
      >
      <div class={s.sectionHead}>
        <span class={s.eyebrow}>Exercise order</span><button
          class={s.button}
          onclick={() => edit()}>+ Add exercise</button
        >
      </div>
      <ul class={s.list}>
        {#each doc.current.exercises as ex, index (ex.id)}
          <li class={s.row}>
            <button
              class={s.queue}
              aria-label="Edit {ex.name}"
              onclick={() => edit(ex)}
              ><span class={s.index}>{String(index + 1).padStart(2, "0")}</span
              ><span
                ><span class={s.queueName}>{ex.name}</span><span class={s.meta}
                  >{sets(ex)} × {ex.reps} · {ex.weight}</span
                ></span
              ></button
            >
            <div class={s.tools}>
              <button
                class={s.button}
                aria-label="Move {ex.name} up"
                disabled={index === 0}
                onclick={() => reorder(index, -1)}>↑</button
              ><button
                class={s.button}
                aria-label="Move {ex.name} down"
                disabled={index === doc.current.exercises.length - 1}
                onclick={() => reorder(index, 1)}>↓</button
              >
            </div>
          </li>
        {/each}
      </ul>
      {#if total > 0}<div class={s.actions}>
          <button class={s.danger} onclick={() => (resetOpen = true)}
            >Reset progress</button
          >
        </div>{/if}
    {:else if finished && !reviewCompleted}
      <section class={s.empty}>
        <div class={s.completeMark} aria-hidden="true">✓</div>
        <span class={s.eyebrow}>Session finished</span>
        <h2 class={s.exerciseName}>Workout complete.</h2>
        <p class={s.description}>{done} sets. All yours.</p>
        <button class={s.primary} onclick={() => (resetOpen = true)}
          >Reset progress</button
        >
      </section>
    {:else if active}
      <section class={s.active} aria-label="Current exercise">
        <div class={s.kicker}>
          <span
            >Exercise {String(
              doc.current.exercises.indexOf(active) + 1,
            ).padStart(2, "0")} / {String(
              doc.current.exercises.length,
            ).padStart(2, "0")}</span
          ><span
            >{complete(active)
              ? "Sets complete"
              : `${checked(active).length} of ${sets(active)} sets`}</span
          >
        </div>
        <h2 class={s.exerciseName}>{active.name}</h2>
        <div class={s.readouts}>
          <div class={s.readout}>
            <strong class={s.number}>{active.reps}</strong><span class={s.small}
              >Reps per set</span
            >
          </div>
          <div class={s.readout}>
            <strong class={s.number}>{active.weight || "Bodyweight"}</strong
            ><span class={s.small}>Target load</span>
          </div>
        </div>
        <div class={s.ticks} aria-label="Sets for {active.name}">
          {#each Array.from({ length: sets(active) }, (_, i) => i) as i}<Checkbox.Root
              class={s.tick}
              checked={checked(active).includes(i)}
              aria-label="Set {i + 1} of {active.name}"
              onCheckedChange={() => toggleSet(active, i)}
              >{checked(active).includes(i) ? "✓" : i + 1}</Checkbox.Root
            >{/each}
        </div>
        <button class={s.primary} onclick={logSet} disabled={complete(active)}
          >{complete(active)
            ? "Exercise complete"
            : `Log set ${(nextSet(active) ?? 0) + 1}`}</button
        >
      </section>
    {:else}
      <section class={s.empty}>
        <span class={s.eyebrow}>Your starting point</span>
        <h2 class={s.exerciseName}>Build your workout.</h2>
        <p class={s.description}>
          Add an exercise and a target. Then take it one set at a time.
        </p>
        <button class={s.primary} onclick={() => edit()}
          >+ Add your first exercise</button
        >
      </section>
    {/if}
    {#if !routine && total > 0}
      <div class={s.sectionHead}>
        <span class={s.eyebrow}>Your routine</span><span class={s.meta}
          >{doc.current.exercises.length} exercises</span
        >
      </div>
      <ul class={s.list}>
        {#each doc.current.exercises as ex, index (ex.id)}<li class={s.row}>
            <button
              class={s.queue}
              aria-current={ex.id === active?.id ? "true" : undefined}
              aria-label="Select {ex.name}"
              onclick={() => select(ex)}
              ><span class={s.index}
                >{complete(ex) ? "✓" : String(index + 1).padStart(2, "0")}</span
              ><span
                ><span class={s.queueName}>{ex.name}</span><span class={s.meta}
                  >{sets(ex)} × {ex.reps} · {ex.weight}</span
                ></span
              ><span class={s.fraction}>{checked(ex).length}/{sets(ex)}</span
              ></button
            >
          </li>{/each}
      </ul>
    {/if}
  </div>
  <section
    class={s.dock}
    aria-label="Rest timer"
    inert={!doc.isReady || doc.isLoading}
  >
    <div class={s.dockTop}>
      <div>
        <span class={s.eyebrow}
          >{restRunning
            ? "Rest / recover"
            : finished
              ? "Session complete"
              : "Rest timer"}</span
        >
        <div class={s.restTime}>
          {restRunning
            ? formatTime(restSeconds)
            : finished
              ? "NICE WORK"
              : formatTime(preset())}
        </div>
      </div>
      <div class={s.controls}>
        {#if restRunning}<button
            class={s.button}
            onclick={() => {
              rest.extend(30);
              syncRest();
            }}>+30s</button
          ><button class={s.button} onclick={finishRest}>Skip</button>
        {:else}<Select.Root
            type="single"
            value={String(doc.current.restPreset)}
            items={PRESETS}
            onValueChange={(value) => {
              if (PRESETS.some((p) => p.value === value))
                doc.current.restPreset = Number(value);
            }}
            ><Select.Trigger class={s.button} aria-label="Rest duration"
              >{PRESETS.find((p) => Number(p.value) === doc.current.restPreset)
                ?.label ?? `${preset()}s`} ▾</Select.Trigger
            ><Select.Portal
              ><Select.Content class={s.selectContent} side="top" sideOffset={6}
                ><Select.Viewport
                  >{#each PRESETS as item}<Select.Item
                      class={s.option}
                      value={item.value}
                      label={item.label}>{item.label}</Select.Item
                    >{/each}</Select.Viewport
                ></Select.Content
              ></Select.Portal
            ></Select.Root
          ><button
            class={s.button}
            disabled={finished || !total}
            onclick={() => startRest()}>Start</button
          >{/if}
      </div>
    </div>
    <Progress.Root
      class={s.progress}
      value={restSeconds}
      max={Math.max(1, restTotal)}
      aria-label="Rest remaining"
      ><div
        class={s.fill}
        style:width={`${restTotal ? (restSeconds / restTotal) * 100 : 0}%`}
      ></div></Progress.Root
    >
    <p class={s.status}>
      {restRunning
        ? `After ${restFor}`
        : "Starts automatically after each set."}
    </p>
  </section>
  {#if doc.error}<div class={s.error} role="alert">
      {doc.isReady
        ? "Changes haven’t been saved."
        : "Your workout couldn’t be loaded."}
      {doc.error}<button
        onclick={() => {
          if (doc.isReady) void doc.flush().catch(() => undefined);
          else void doc.reload();
        }}>Try again</button
      >
    </div>{:else if doc.isLoading}<p class={s.error} role="status">
      Loading your workout…
    </p>{/if}
  <span
    role="status"
    style="position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%)"
    >{announcement}</span
  >
</main>
<Dialog.Root bind:open={dialogOpen}
  ><Dialog.Portal
    ><Dialog.Overlay class={s.overlay} /><Dialog.Content class={s.dialog}>
      <Dialog.Title class={s.dialogTitle}
        >{existing ? "Edit exercise" : "Add an exercise"}</Dialog.Title
      ><Dialog.Description class={s.description}
        >Set your target. Make it yours.</Dialog.Description
      >
      {#if draft}<form
          onsubmit={(event) => {
            event.preventDefault();
            saveExercise();
          }}
        >
          <div class={s.fields}>
            <label class={s.field}
              >Exercise name<input
                class={s.input}
                aria-label="Exercise name"
                bind:value={draft.name}
                required
              /></label
            >
            <div class={s.pair}>
              <label class={s.field}
                >Sets<input
                  class={s.input}
                  type="number"
                  min="1"
                  max="12"
                  step="1"
                  aria-label="Target sets"
                  bind:value={draft.sets}
                  required
                /></label
              ><label class={s.field}
                >Reps per set<input
                  class={s.input}
                  type="number"
                  min="1"
                  max="50"
                  step="1"
                  aria-label="Target reps"
                  bind:value={draft.reps}
                  required
                /></label
              >
            </div>
            <label class={s.field}
              >Weight / load<input
                class={s.input}
                aria-label="Weight"
                bind:value={draft.weight}
                placeholder="Bodyweight, 20 kg…"
              /></label
            >
          </div>
          {#if formError}<p class={s.error} role="alert">{formError}</p>{/if}
          <div class={s.actions}>
            {#if existing}<button
                class={s.danger}
                type="button"
                onclick={removeExercise}>Delete</button
              >{/if}<Dialog.Close class={s.button} type="button"
              >Cancel</Dialog.Close
            ><button class={s.button} type="submit">Save exercise</button>
          </div>
        </form>{/if}
    </Dialog.Content></Dialog.Portal
  ></Dialog.Root
>
<AlertDialog.Root bind:open={resetOpen}
  ><AlertDialog.Portal
    ><AlertDialog.Overlay class={s.overlay} /><AlertDialog.Content
      class={s.dialog}
      ><AlertDialog.Title class={s.dialogTitle}
        >Ready for another round?</AlertDialog.Title
      ><AlertDialog.Description class={s.description}
        >Clear all completed sets and stop the rest timer. Your exercises and
        targets stay here.</AlertDialog.Description
      >
      <div class={s.actions}>
        <AlertDialog.Cancel class={s.button}>Keep progress</AlertDialog.Cancel
        ><AlertDialog.Action class={s.button} onclick={resetProgress}
          >Reset progress</AlertDialog.Action
        >
      </div></AlertDialog.Content
    ></AlertDialog.Portal
  ></AlertDialog.Root
>
<IconTarget><Icon completed={done} {total} /></IconTarget><ExportTarget
  ><Export data={doc.current} /></ExportTarget
>
