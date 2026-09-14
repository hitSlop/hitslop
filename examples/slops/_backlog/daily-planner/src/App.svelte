<script lang="ts">
  import { ready } from "@hitslop/runtime";
  import { jsonStore, IconTarget, ExportTarget } from "@hitslop/svelte";
  import { Checkbox, Dialog, Select } from "bits-ui";
  import Check from "@lucide/svelte/icons/check";
  import Plus from "@lucide/svelte/icons/plus";
  import ArrowDownToLine from "@lucide/svelte/icons/arrow-down-to-line";
  import NotebookPen from "@lucide/svelte/icons/notebook-pen";
  import { onDestroy, tick, untrack } from "svelte";
  import plannerSchema, { KINDS, type Block } from "../schema";
  import Icon from "./Icon.svelte";
  import Export from "./Export.svelte";
  import DatePicker from "./DatePicker.svelte";
  import * as s from "./styles.css";
  import {
    DAY_START,
    DAY_END,
    HOURS,
    SNAP,
    today,
    localDate,
    formatDate,
    layout,
    offsetOf,
    rangeOf,
    toClock,
    toLabel,
    bookedMinutesOf,
    adjustRange,
    validRange,
    scrollForTime,
  } from "./schedule";
  const planner = jsonStore({
    schema: plannerSchema,
    initial: {
      date: today(),
      priorities: [
        { text: "Finish the quarterly summary", done: false },
        { text: "Call the framer back", done: true },
        { text: "", done: false },
      ],
      blocks: [
        {
          id: "reading",
          start: "07:00",
          end: "08:00",
          title: "Reading and coffee",
          kind: "personal",
        },
        {
          id: "summary",
          start: "09:00",
          end: "11:00",
          title: "Quarterly summary — first pass",
          kind: "focus",
        },
        {
          id: "standup",
          start: "11:00",
          end: "11:30",
          title: "Team stand-up",
          kind: "meeting",
        },
        {
          id: "lunch",
          start: "12:30",
          end: "13:15",
          title: "Lunch away from the desk",
          kind: "break",
        },
        {
          id: "framer",
          start: "14:00",
          end: "14:30",
          title: "Call the framer",
          kind: "meeting",
        },
        {
          id: "edits",
          start: "15:00",
          end: "17:00",
          title: "Edits and inbox",
          kind: "focus",
        },
        {
          id: "swim",
          start: "18:30",
          end: "19:30",
          title: "Swim",
          kind: "personal",
        },
      ],
      notes:
        "Book the van for Saturday. Ask about the delivery window before confirming.",
    },
  });

  $effect(() => {
    if (planner.isReady) ready();
  });
  onDestroy(() => planner.destroy());
  let now = $state(new Date());
  let follow = $state(true);
  let viewport = $state<HTMLDivElement>();
  let field = $state<HTMLDivElement>();
  const isToday = $derived(planner.current.date === localDate(now));
  const nowMinutes = $derived(now.getHours() * 60 + now.getMinutes());
  const booked = $derived(bookedMinutesOf(planner.current.blocks));
  let editOpen = $state(false);
  let editing = $state<Block>({
    id: "",
    title: "",
    start: "09:00",
    end: "10:00",
    kind: "focus",
  });
  let isNew = $state(false);
  let formError = $state("");
  let notesOpen = $state(false);
  let notesDraft = $state("");
  let returnFocus: HTMLElement | null = null;
  function pauseFollow() {
    follow = false;
  }
  function focusTime(minutes: number) {
    if (!viewport || !field) return;
    const hour = field.offsetHeight / HOURS.length;
    viewport.scrollTop = scrollForTime(
      minutes,
      hour,
      viewport.clientHeight,
      viewport.scrollHeight,
    );
  }
  $effect(() => {
    const date = planner.current.date;
    const loaded = planner.isReady;
    if (loaded && viewport) {
      untrack(() => {
        follow = true;
        void tick().then(() =>
          focusTime(date === localDate(now) ? nowMinutes : 480),
        );
      });
    }
  });
  $effect(() => {
    const clock = setInterval(() => {
      now = new Date();
      if (follow && isToday && !editOpen && !notesOpen && !gesture)
        focusTime(nowMinutes);
    }, 60_000);
    const refresh = () => {
      if (document.visibilityState === "visible") {
        now = new Date();
        if (follow && isToday) focusTime(nowMinutes);
      }
    };
    document.addEventListener("visibilitychange", refresh);
    return () => {
      clearInterval(clock);
      document.removeEventListener("visibilitychange", refresh);
    };
  });
  function goNow() {
    now = new Date();
    planner.current.date = today();
    follow = true;
    void tick().then(() => focusTime(nowMinutes));
  }
  function openEditor(
    block?: Block,
    start = Math.min(Math.max(nowMinutes, DAY_START), DAY_END - 60),
    end = start + 60,
  ) {
    pauseFollow();
    returnFocus = document.activeElement as HTMLElement;
    isNew = !block;
    formError = "";
    editing = block
      ? { ...block }
      : {
          id: crypto.randomUUID(),
          title: "",
          start: toClock(Math.floor(start / SNAP) * SNAP),
          end: toClock(Math.min(Math.floor(end / SNAP) * SNAP, DAY_END)),
          kind: "focus",
        };
    editOpen = true;
  }
  function saveBlock(event: SubmitEvent) {
    event.preventDefault();
    if (!validRange(editing.start, editing.end)) {
      formError =
        "Choose at least 15 minutes between 6am and midnight. Use 00:00 for midnight.";
      return;
    }
    if (!editing.title.trim()) {
      formError = "Give this block a title.";
      return;
    }
    if (isNew)
      planner.current.blocks.push({ ...editing, title: editing.title.trim() });
    else {
      const block = planner.current.blocks.find((b) => b.id === editing.id);
      if (block) Object.assign(block, editing, { title: editing.title.trim() });
    }
    editOpen = false;
  }
  function deleteBlock() {
    planner.current.blocks = planner.current.blocks.filter(
      (b) => b.id !== editing.id,
    );
    editOpen = false;
  }
  function restoreFocus(event: Event) {
    event.preventDefault();
    (returnFocus?.isConnected
      ? returnFocus
      : document.querySelector<HTMLElement>("[data-add-block]")
    )?.focus({ preventScroll: true });
  }
  type Gesture = {
    id: string | null;
    mode: "move" | "start" | "end" | "draw";
    anchor: number;
    start: number;
    end: number;
    originY: number;
    moved: boolean;
  };
  let gesture = $state<Gesture | null>(null);
  let preview = $state<{ start: number; end: number } | null>(null);
  let pointerY = 0;
  let raf = 0;
  const placed = $derived(
    layout(
      planner.current.blocks.map((b) =>
        gesture?.id === b.id && preview
          ? { ...b, start: toClock(preview.start), end: toClock(preview.end) }
          : b,
      ),
    ),
  );
  function minutesAt(y: number) {
    const rect = field?.getBoundingClientRect();
    return rect
      ? Math.max(
          DAY_START,
          Math.min(
            DAY_END,
            Math.round(
              (DAY_START +
                ((y - rect.top) / rect.height) * (DAY_END - DAY_START)) /
                SNAP,
            ) * SNAP,
          ),
        )
      : DAY_START;
  }
  function startGesture(
    event: PointerEvent,
    block?: Block,
    mode: "move" | "start" | "end" = "move",
  ) {
    if (event.button !== 0) return;
    pauseFollow();
    const anchor = Math.min(minutesAt(event.clientY), DAY_END - SNAP);
    gesture = {
      id: block?.id ?? null,
      mode: block ? mode : "draw",
      anchor,
      ...(block ? rangeOf(block) : { start: anchor, end: anchor + SNAP }),
      originY: event.clientY,
      moved: false,
    };
    preview = { start: gesture.start, end: gesture.end };
    pointerY = event.clientY;
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    event.preventDefault();
    event.stopPropagation();
    raf = requestAnimationFrame(autoScroll);
  }
  function updatePreview() {
    if (!gesture) return;
    const at = minutesAt(pointerY);
    preview =
      gesture.mode === "draw"
        ? {
            start: Math.min(gesture.anchor, at),
            end: Math.min(DAY_END, Math.max(gesture.anchor + SNAP, at)),
          }
        : adjustRange(gesture, gesture.mode, at - gesture.anchor);
  }
  function moveGesture(event: PointerEvent) {
    if (!gesture) return;
    pointerY = event.clientY;
    if (Math.abs(pointerY - gesture.originY) > 3) gesture.moved = true;
    if (gesture.moved) updatePreview();
  }
  function autoScroll() {
    if (!gesture || !viewport) return;
    const r = viewport.getBoundingClientRect();
    const delta = pointerY < r.top + 32 ? -6 : pointerY > r.bottom - 32 ? 6 : 0;
    if (delta && gesture.moved) {
      viewport.scrollTop += delta;
      updatePreview();
    }
    raf = requestAnimationFrame(autoScroll);
  }
  function cancelGesture() {
    cancelAnimationFrame(raf);
    gesture = null;
    preview = null;
  }
  function endGesture() {
    if (!gesture || !preview) return;
    const g = gesture,
      next = preview;
    cancelGesture();
    if (!g.id) {
      if (!g.moved) {
        next.start = Math.min(next.start, DAY_END - 60);
        next.end = next.start + 60;
      }
      openEditor(undefined, next.start, next.end);
    } else {
      const b = planner.current.blocks.find((b) => b.id === g.id);
      if (b) {
        if (g.moved) {
          b.start = toClock(next.start);
          b.end = toClock(next.end);
        } else if (g.mode === "move") openEditor(b);
      }
    }
  }
  function nudge(
    event: KeyboardEvent,
    block: Block,
    mode: "move" | "start" | "end",
  ) {
    const delta =
      event.key === "ArrowUp" ? -SNAP : event.key === "ArrowDown" ? SNAP : 0;
    if (!delta) return;
    event.preventDefault();
    pauseFollow();
    const r = adjustRange(rangeOf(block), mode, delta);
    block.start = toClock(r.start);
    block.end = toClock(r.end);
  }
  onDestroy(() => cancelAnimationFrame(raf));
</script>

<svelte:window
  onkeydown={(event) => {
    if (event.key === "Escape") cancelGesture();
  }}
/>
<main
  class={s.canvas}
  data-slop-selection="none"
  aria-label="Daily planner"
  aria-busy={planner.isLoading}
>
  <article class={s.page} inert={!planner.isReady || planner.isLoading}>
    <header class={s.header}>
      <div class={s.headerTop}>
        <span class={s.eyebrow}>DAILY / PLANNER</span><button
          class={s.nowButton}
          onclick={goNow}
          aria-label="Go to now"
          data-following={follow && isToday}
          ><ArrowDownToLine size={13} /> Now</button
        >
      </div>
      <div class={s.headerMain}>
        <h1 class={s.title}>
          {formatDate(planner.current.date, { weekday: "long" })}
        </h1>
        <span class={s.dateNumber}
          >{formatDate(planner.current.date, { day: "2-digit" })}</span
        >
      </div>
      <DatePicker bind:value={planner.current.date} />
    </header>
    <section class={s.priorities} aria-label="Top three priorities">
      <div class={s.sectionHead}>
        <h2 class={s.heading}>Make room for</h2>
        <span class={s.meta}
          >{planner.current.priorities.filter((p) => p.done).length} / {planner
            .current.priorities.length}</span
        >
      </div>
      <ol class={s.priorityList}>
        {#each planner.current.priorities as priority, index}<li
            class={s.priority}
            data-done={priority.done}
          >
            <Checkbox.Root
              class={s.checkbox}
              checked={priority.done}
              onCheckedChange={(checked) => {
                priority.done = checked === true;
              }}
              aria-label="Complete priority {index + 1}"
              >{#snippet children({ checked })}{#if checked}<Check
                    size={12}
                  />{:else}{index + 1}{/if}{/snippet}</Checkbox.Root
            >
            <input
              class={s.priorityText}
              aria-label="Priority {index + 1}"
              placeholder="A little room for…"
              bind:value={priority.text}
              onfocus={pauseFollow}
            />
          </li>{/each}
      </ol>
    </section>
    <div class={s.scheduleHead}>
      <div>
        <h2 class={s.heading}>Your day</h2>
        <span class={s.meta}
          >{Math.floor(booked / 60)}h {booked % 60
            ? `${booked % 60}m `
            : ""}planned</span
        >
      </div>
      <button class={s.addButton} data-add-block onclick={() => openEditor()}
        ><Plus size={14} /> Add block</button
      >
    </div>
    <!-- The labeled scroll region is keyboard-focusable so arrow/page keys can scroll it. -->
    <!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
    <div
      class={s.scroll}
      bind:this={viewport}
      onwheel={pauseFollow}
      ontouchstart={pauseFollow}
      onpointerdown={pauseFollow}
      onkeydown={(e) => {
        if (
          [
            "ArrowDown",
            "ArrowUp",
            "PageDown",
            "PageUp",
            "Home",
            "End",
            " ",
          ].includes(e.key)
        )
          pauseFollow();
      }}
      tabindex="0"
      role="region"
      aria-label="Day timeline"
    >
      <div class={s.rail}>
        <div class={s.gutter} aria-hidden="true">
          {#each HOURS as hour}<span class={s.hour}>{toLabel(hour)}</span
            >{/each}
        </div>
        <div class={s.field} bind:this={field}>
          <button
            class={s.sheet}
            aria-label="Draw a time block"
            onpointerdown={(e) => startGesture(e)}
            onpointermove={moveGesture}
            onpointerup={endGesture}
            onpointercancel={cancelGesture}
            onkeydown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                openEditor();
              }
            }}
          ></button>
          {#if !placed.length}<p class={s.empty}>
              A little structure.<br />A lot of possibility.<small
                >Drag to make time for something.</small
              >
            </p>{/if}
          {#each placed as item (item.block.id)}
            <article
              class={s.block}
              data-kind={item.block.kind}
              data-short={item.end - item.start < 60}
              data-tiny={item.end - item.start <= 15}
              data-active={gesture?.id === item.block.id}
              style="--top:{offsetOf(item.start)};--span:{(item.end -
                item.start) /
                60};--column:{item.column};--columns:{item.columns}"
            >
              <button
                class={s.blockBody}
                aria-label="Edit {item.block.title ||
                  'Untitled block'}, {toLabel(item.start)} to {toLabel(
                  item.end,
                )}, {item.block.kind}"
                title="{item.block.title} · {toLabel(item.start)}–{toLabel(
                  item.end,
                )} · {item.block.kind}"
                onpointerdown={(e) => startGesture(e, item.block)}
                onpointermove={moveGesture}
                onpointerup={endGesture}
                onpointercancel={cancelGesture}
                onkeydown={(e) => nudge(e, item.block, "move")}
                onclick={(e) => {
                  if (e.detail === 0) openEditor(item.block);
                }}
              >
                <strong class={s.blockTitle}
                  >{item.block.title || "Untitled block"}</strong
                ><span class={s.blockDetail}
                  >{toLabel(item.start)}–{toLabel(item.end)} · {item.block
                    .kind}</span
                >
              </button>
              {#each ["start", "end"] as edge}<button
                  class={[
                    s.handle,
                    edge === "start" ? s.startHandle : s.endHandle,
                  ]}
                  aria-label="Resize {edge} of {item.block.title}"
                  onpointerdown={(e) =>
                    startGesture(e, item.block, edge as "start" | "end")}
                  onpointermove={moveGesture}
                  onpointerup={endGesture}
                  onpointercancel={cancelGesture}
                  onkeydown={(e) =>
                    nudge(e, item.block, edge as "start" | "end")}
                ></button>{/each}
            </article>
          {/each}
          {#if gesture?.mode === "draw" && preview}<div
              class={s.draft}
              style="--top:{offsetOf(preview.start)};--span:{(preview.end -
                preview.start) /
                60}"
            >
              {toLabel(preview.start)}–{toLabel(preview.end)}
            </div>{/if}
          {#if isToday && nowMinutes >= DAY_START && nowMinutes < DAY_END}<div
              class={s.nowLine}
              style="--top:{offsetOf(nowMinutes)}"
              aria-label="Current time {toLabel(nowMinutes)}"
            >
              <span class={s.nowTag}>{toLabel(nowMinutes)}</span>
            </div>{/if}
        </div>
      </div>
    </div>
    <button
      class={s.notesButton}
      onclick={() => {
        pauseFollow();
        returnFocus = document.activeElement as HTMLElement;
        notesDraft = planner.current.notes;
        notesOpen = true;
      }}
      ><NotebookPen size={17} /><span
        ><b>Day notes</b><small
          >{planner.current.notes || "Something to remember…"}</small
        ></span
      ><span aria-hidden="true">↗</span></button
    >
  </article>
  {#if planner.error}<p class={s.error} role="alert">
      {planner.error}<button
        onclick={() => {
          if (planner.isReady) void planner.flush().catch(() => undefined);
          else void planner.reload();
        }}>Try again</button
      >
    </p>{/if}
</main>
<Dialog.Root bind:open={editOpen}
  ><Dialog.Portal
    ><Dialog.Overlay class={s.overlay} /><Dialog.Content
      class={s.dialog}
      onCloseAutoFocus={restoreFocus}
    >
      <Dialog.Title class={s.dialogTitle}
        >{isNew ? "Make some time" : "Edit your block"}</Dialog.Title
      ><Dialog.Description class={s.description}
        >A place for what matters today.</Dialog.Description
      >
      <form class={s.form} onsubmit={saveBlock}>
        <label class={s.label}
          >What’s happening?<input
            class={s.input}
            bind:value={editing.title}
            placeholder="A little focused work"
            required
          /></label
        >
        <div class={s.timeRow}>
          <label class={s.label}
            >From<input
              class={s.input}
              type="time"
              step="900"
              bind:value={editing.start}
              required
            /></label
          ><label class={s.label}
            >Until<input
              class={s.input}
              type="time"
              step="900"
              bind:value={editing.end}
              required
            /></label
          >
        </div>
        <label class={s.label} for="block-kind">Kind</label><Select.Root
          type="single"
          bind:value={editing.kind}
          ><Select.Trigger id="block-kind" class={s.input}
            >{editing.kind} ▾</Select.Trigger
          ><Select.Portal
            ><Select.Content class={s.selectContent} sideOffset={5}
              ><Select.Viewport
                >{#each KINDS as kind}<Select.Item
                    class={s.selectItem}
                    value={kind}
                    label={kind}>{kind}</Select.Item
                  >{/each}</Select.Viewport
              ></Select.Content
            ></Select.Portal
          ></Select.Root
        >
        {#if formError}<p role="alert" class={s.error}>{formError}</p>{/if}
        <div class={s.actions}>
          {#if !isNew}<button
              class={s.deleteButton}
              type="button"
              onclick={deleteBlock}>Delete</button
            >{/if}<Dialog.Close class={s.secondary} type="button"
            >Cancel</Dialog.Close
          ><button class={s.primary} type="submit">Save block</button>
        </div>
      </form>
    </Dialog.Content></Dialog.Portal
  ></Dialog.Root
>
<Dialog.Root bind:open={notesOpen}
  ><Dialog.Portal
    ><Dialog.Overlay class={s.overlay} /><Dialog.Content
      class={s.dialog}
      onCloseAutoFocus={restoreFocus}
      ><Dialog.Title class={s.dialogTitle}>Day notes</Dialog.Title
      ><Dialog.Description class={s.description}
        >Keep a thought. Clear a little headspace.</Dialog.Description
      >
      <form
        class={s.form}
        onsubmit={(e) => {
          e.preventDefault();
          planner.current.notes = notesDraft;
          notesOpen = false;
        }}
      >
        <textarea
          class={s.textarea}
          aria-label="Notes for the day"
          bind:value={notesDraft}
          placeholder="Something to remember…"></textarea>
        <div class={s.actions}>
          <Dialog.Close type="button" class={s.secondary}>Cancel</Dialog.Close
          ><button type="submit" class={s.primary}>Save notes</button>
        </div>
      </form></Dialog.Content
    ></Dialog.Portal
  ></Dialog.Root
>
<IconTarget><Icon /></IconTarget><ExportTarget
  ><Export data={planner.current} /></ExportTarget
>
