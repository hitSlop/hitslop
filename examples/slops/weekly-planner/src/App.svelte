<script lang="ts">
  import { ready } from "@hitslop/runtime";
  import { jsonStore, IconTarget, ExportTarget } from "@hitslop/svelte";
  import { onDestroy, tick } from "svelte";
  import { Dialog, Select, Checkbox } from "bits-ui";
  import plannerSchema, { type Task } from "../schema";
  import {
    HOUR,
    COLORS,
    minutes,
    clock,
    label,
    duration,
    snap,
    move,
    resize,
    layout,
  } from "./schedule";
  import Icon from "./Icon.svelte";
  import Export from "./Export.svelte";
  import * as s from "./styles.css";
  const doc = jsonStore({
    schema: plannerSchema,
    initial: {
      week: "Week of Oct 12 — 18",
      focus: "Ship the v2 release & celebrate.",
      days: [
        {
          id: "MON",
          name: "MON",
          date: "12",
          tasks: [
            {
              id: "sync",
              time: "09:00",
              title: "Team sync",
              done: true,
              durationMinutes: 60,
              color: "sky",
            },
            {
              id: "design",
              time: "14:00",
              title: "Design review",
              done: true,
              durationMinutes: 90,
              color: "lilac",
            },
          ],
        },
        {
          id: "TUE",
          name: "TUE",
          date: "13",
          tasks: [
            {
              id: "interview",
              time: "10:30",
              title: "Customer interview",
              done: true,
              durationMinutes: 60,
              color: "coral",
            },
            {
              id: "api",
              time: "15:00",
              title: "API integration",
              done: false,
              durationMinutes: 60,
              color: "mint",
            },
          ],
        },
        {
          id: "WED",
          name: "WED",
          date: "14",
          tasks: [
            {
              id: "refactor",
              time: "09:00",
              title: "Refactor models",
              done: false,
              durationMinutes: 90,
              color: "sky",
            },
            {
              id: "tests",
              time: "13:30",
              title: "Run test suite",
              done: false,
              durationMinutes: 60,
              color: "lilac",
            },
          ],
        },
        {
          id: "THU",
          name: "THU",
          date: "15",
          tasks: [
            {
              id: "staging",
              time: "11:00",
              title: "Staging deploy",
              done: false,
              durationMinutes: 60,
              color: "coral",
            },
            {
              id: "qa",
              time: "16:00",
              title: "QA pass",
              done: false,
              durationMinutes: 90,
              color: "mint",
            },
          ],
        },
        {
          id: "FRI",
          name: "FRI",
          date: "16",
          tasks: [
            {
              id: "launch",
              time: "10:00",
              title: "Production launch",
              done: false,
              durationMinutes: 60,
              color: "sky",
            },
            {
              id: "demo",
              time: "17:00",
              title: "Team demo & toast",
              done: false,
              durationMinutes: 60,
              color: "lilac",
            },
          ],
        },
        {
          id: "SAT",
          name: "SAT",
          date: "17",
          tasks: [
            {
              id: "market",
              time: "09:30",
              title: "Farmers market",
              done: false,
              durationMinutes: 90,
              color: "coral",
            },
          ],
        },
        {
          id: "SUN",
          name: "SUN",
          date: "18",
          tasks: [
            {
              id: "next-week",
              time: "",
              title: "Plan next week",
              done: false,
              durationMinutes: 60,
              color: "mint",
            },
          ],
        },
      ],
    },
  });
  $effect(() => {
    if (doc.isReady) ready();
  });
  let scroller: HTMLDivElement;
  let board: HTMLDivElement;
  let positioned = false;
  $effect(() => {
    if (doc.isReady && !positioned) {
      positioned = true;
      void tick().then(() =>
        requestAnimationFrame(() => {
          const lane = board?.querySelector<HTMLElement>("[data-lane]");
          if (lane) scroller.scrollTop = lane.offsetTop + 8 * HOUR - 57;
        }),
      );
    }
  });
  const allTasks = $derived(doc.current.days.flatMap((day) => day.tasks));
  const doneCount = $derived(allTasks.filter((task) => task.done).length);
  let dialogOpen = $state(false);
  let editor = $state<{
    source: number;
    task: Task;
    day: string;
    scheduled: boolean;
  } | null>(null);
  let message = $state("");
  let formError = $state("");
  const dayItems = $derived(
    doc.current.days.map((day) => ({ value: day.id, label: day.name })),
  );
  const colorItems = COLORS.map((value) => ({
    value,
    label: value[0].toUpperCase() + value.slice(1),
  }));
  function edit(index: number, task?: Task, start?: number, span = 60) {
    const day = doc.current.days[index];
    if (!day) return;
    editor = {
      source: task ? index : -1,
      day: day.id,
      scheduled: task ? minutes(task.time) !== null : start !== undefined,
      task: task
        ? { ...task }
        : {
            id: crypto.randomUUID(),
            title: "",
            time: start === undefined ? "" : clock(start),
            done: false,
            durationMinutes: span,
            color: "sky",
          },
    };
    formError = "";
    dialogOpen = true;
  }
  function save() {
    if (!editor) return;
    const target = doc.current.days.find((day) => day.id === editor!.day);
    if (!target) return;
    const start = minutes(editor.task.time);
    if (!editor.task.title.trim()) {
      formError = "Give this block a title.";
      return;
    }
    if (
      editor.scheduled &&
      (start === null || start + duration(editor.task) > 1440)
    ) {
      formError = "Choose a valid start and a duration that ends by midnight.";
      return;
    }
    const task = {
      ...editor.task,
      time: editor.scheduled ? editor.task.time : "",
    };
    if (editor.source >= 0)
      doc.current.days[editor.source].tasks = doc.current.days[
        editor.source
      ].tasks.filter((item) => item.id !== task.id);
    target.tasks.push(task);
    dialogOpen = false;
  }
  function remove() {
    if (!editor || editor.source < 0) return;
    doc.current.days[editor.source].tasks = doc.current.days[
      editor.source
    ].tasks.filter((item) => item.id !== editor!.task.id);
    dialogOpen = false;
  }
  type Gesture = {
    source: number;
    id: string | null;
    mode: "move" | "start" | "end" | "draw";
    origin: number;
    start: number;
    end: number;
    x: number;
    y: number;
    moved: boolean;
    day: number;
    nextStart: number | null;
    nextEnd: number;
    anchor: number;
  };
  let gesture = $state<Gesture | null>(null);
  let pointer = { x: 0, y: 0 };
  let raf = 0;
  function hit(x: number, y: number) {
    const lanes = board.querySelectorAll<HTMLElement>("[data-lane]");
    if (!lanes.length) return { day: 0, at: 0, anytime: false };
    const first = lanes[0].getBoundingClientRect();
    const day = Math.max(
      0,
      Math.min(lanes.length - 1, Math.floor((x - first.left) / first.width)),
    );
    return {
      day,
      at: Math.max(0, Math.min(1440, snap(((y - first.top) / HOUR) * 60))),
      anytime: y < first.top,
    };
  }
  function begin(
    event: PointerEvent,
    day: number,
    task: Task | null,
    mode: Gesture["mode"],
  ) {
    if (event.button !== 0) return;
    event.stopPropagation();
    const at = hit(event.clientX, event.clientY).at;
    const start = Math.min(task ? (minutes(task.time) ?? at) : at, 1425);
    const end = Math.min(1440, start + (task ? duration(task) : 15));
    gesture = {
      source: day,
      id: task?.id ?? null,
      mode,
      origin: at,
      start,
      end,
      x: event.clientX,
      y: event.clientY,
      moved: false,
      day,
      nextStart: task && minutes(task.time) === null ? null : start,
      nextEnd: end,
      anchor: start,
    };
    pointer = { x: event.clientX, y: event.clientY };
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    if (mode !== "draw") event.preventDefault();
  }
  function updatePosition() {
    if (!gesture) return;
    const g = gesture;
    const point = hit(pointer.x, pointer.y);
    if (g.mode === "move") {
      g.day = point.day;
      g.nextStart = point.anytime
        ? null
        : move(g.start + point.at - g.origin, g.end - g.start);
      g.nextEnd = (g.nextStart ?? 0) + g.end - g.start;
    } else if (g.mode === "draw") {
      g.nextStart = Math.min(g.anchor, Math.min(point.at, 1425));
      g.nextEnd = Math.max(g.anchor + 15, point.at);
    } else {
      const next = resize(
        g.start,
        g.end,
        g.start +
          point.at -
          g.origin +
          (g.mode === "end" ? g.end - g.start : 0),
        g.mode,
      );
      g.nextStart = next.start;
      g.nextEnd = next.end;
    }
    message = `${doc.current.days[g.day]?.name}: ${g.nextStart === null ? "Anytime" : label(g.nextStart) + " – " + label(g.nextEnd)}`;
  }
  function autoScroll() {
    if (!gesture?.moved) {
      raf = 0;
      return;
    }
    const rect = scroller.getBoundingClientRect();
    const speed = (value: number, min: number, max: number) =>
      value < min + 36 ? -10 : value > max - 36 ? 10 : 0;
    scroller.scrollBy(
      speed(pointer.x, rect.left + 48, rect.right),
      speed(pointer.y, rect.top + 58, rect.bottom),
    );
    updatePosition();
    raf = requestAnimationFrame(autoScroll);
  }
  function pointerMove(event: PointerEvent) {
    if (!gesture) return;
    pointer = { x: event.clientX, y: event.clientY };
    if (Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) > 5)
      gesture.moved = true;
    if (!gesture.moved) return;
    updatePosition();
    if (!raf) raf = requestAnimationFrame(autoScroll);
  }
  function cancel() {
    gesture = null;
    cancelAnimationFrame(raf);
    raf = 0;
    message = "";
  }
  function finish() {
    if (!gesture) return;
    const g = { ...gesture };
    cancel();
    if (!g.moved) {
      if (g.id) {
        const task = doc.current.days[g.source].tasks.find(
          (item) => item.id === g.id,
        );
        if (task) edit(g.source, task);
      } else edit(g.source, undefined, Math.min(g.start, 1380));
      return;
    }
    if (g.mode === "draw") {
      edit(g.day, undefined, g.nextStart ?? 0, g.nextEnd - (g.nextStart ?? 0));
      return;
    }
    const source = doc.current.days[g.source];
    const task = source.tasks.find((item) => item.id === g.id);
    if (!task) return;
    task.time = g.nextStart === null ? "" : clock(g.nextStart);
    task.durationMinutes =
      g.nextStart === null ? g.end - g.start : g.nextEnd - g.nextStart;
    if (g.day !== g.source) {
      source.tasks = source.tasks.filter((item) => item.id !== g.id);
      doc.current.days[g.day].tasks.push(task);
    }
    message = `Moved ${task.title} to ${doc.current.days[g.day].name}, ${task.time || "Anytime"}`;
  }
  function keyboard(
    event: KeyboardEvent,
    day: number,
    task: Task,
    edge?: "start" | "end",
  ) {
    if (!event.key.startsWith("Arrow")) return;
    event.preventDefault();
    if (!edge && (event.key === "ArrowLeft" || event.key === "ArrowRight")) {
      const next = day + (event.key === "ArrowLeft" ? -1 : 1);
      if (next < 0 || next >= doc.current.days.length) return;
      doc.current.days[day].tasks = doc.current.days[day].tasks.filter(
        (item) => item.id !== task.id,
      );
      doc.current.days[next].tasks.push(task);
      requestAnimationFrame(() =>
        board
          .querySelector<HTMLButtonElement>(
            `[data-task-id="${CSS.escape(task.id)}"]`,
          )
          ?.focus(),
      );
      message = `${task.title}, ${doc.current.days[next].name}`;
    } else if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      const start = minutes(task.time);
      if (start === null) return;
      const span = Math.min(duration(task), 1440 - start);
      const step = event.key === "ArrowUp" ? -15 : 15;
      if (edge) {
        const next = resize(
          start,
          start + span,
          (edge === "start" ? start : start + span) + step,
          edge,
        );
        task.time = clock(next.start);
        task.durationMinutes = next.end - next.start;
      } else task.time = clock(move(start + step, span));
      message = `${task.title}, ${task.time}`;
    }
  }
  onDestroy(() => {
    cancelAnimationFrame(raf);
    doc.destroy();
  });
</script>

<svelte:window
  onpointermove={pointerMove}
  onpointerup={finish}
  onpointercancel={cancel}
  onkeydown={(event) => {
    if (event.key === "Escape") cancel();
  }}
/>
<main class={s.canvas} aria-label="Weekly planner" aria-busy={doc.isLoading}>
  <header class={s.header} inert={!doc.isReady}>
    <div class={s.identity}>
      <span class={s.eyebrow}>Weekly planner</span><input
        class={s.weekTitle}
        aria-label="Week title"
        bind:value={doc.current.week}
      />
    </div>
    <label class={s.focus}
      >THIS WEEK’S FOCUS<input
        aria-label="Weekly focus"
        placeholder="One thing that matters"
        bind:value={doc.current.focus}
      /></label
    >
  </header>
  <div class={s.toolbar}>
    <button
      class={s.button}
      onclick={() => {
        scroller.scrollTop = 0;
      }}>Anytime tasks</button
    ><button class={s.primary} onclick={() => edit(0)} disabled={!doc.isReady}
      >+ Add block</button
    >
  </div>
  <div class={s.scroll} bind:this={scroller} inert={!doc.isReady}>
    <div class={s.board} bind:this={board}>
      <div class={s.corner}>WEEK</div>
      {#each doc.current.days as day, index (day.id)}
        <div class={s.dayHead}>
          <div>
            <span class={s.dayName}>{day.name}</span>
            <div class={s.date}>{day.date}</div>
          </div>
          <button
            class={s.add}
            aria-label="Add block on {day.name}"
            onclick={() => edit(index)}>+</button
          >
        </div>
      {/each}
      <div class={s.anytimeLabel}>ANYTIME</div>
      {#each doc.current.days as day, index (day.id)}
        <div class={s.anytime} data-anytime={index}>
          {#each day.tasks.filter((task) => minutes(task.time) === null) as task (task.id)}
            <div
              class={s.untimed}
              data-color={task.color ?? "sky"}
              data-done={task.done}
            >
              <button
                class={s.blockBody}
                data-task-id={task.id}
                aria-label="Edit or move {task.title ||
                  'block'}, {day.name}, Anytime"
                onpointerdown={(event) => begin(event, index, task, "move")}
                onclick={(event) => {
                  if (event.detail === 0) edit(index, task);
                }}
                onkeydown={(event) => keyboard(event, index, task)}
                >{task.done ? "✓ " : ""}{task.title || "Untitled"}</button
              >
            </div>
          {/each}
          {#if gesture?.moved && gesture.day === index && gesture.nextStart === null}<span
              class={s.eyebrow}>Drop here</span
            >{/if}
        </div>
      {/each}
      <div class={s.gutter}>
        {#each Array.from({ length: 24 }, (_, i) => i) as hour}<div
            class={s.hour}
          >
            {label(hour * 60)}
          </div>{/each}
      </div>
      {#each doc.current.days as day, index (day.id)}
        <div class={s.lane} data-lane={index}>
          <button
            class={s.sheet}
            aria-label="Draw a block on {day.name}"
            onpointerdown={(event) => begin(event, index, null, "draw")}
            onclick={(event) => {
              if (event.detail === 0) edit(index, undefined, 540);
            }}
          ></button>
          {#each layout(day.tasks) as item (item.task.id)}
            <article
              class={s.block}
              data-color={item.task.color ?? "sky"}
              data-done={item.task.done}
              data-active={gesture?.id === item.task.id && gesture.moved}
              style:top={`${(item.start / 60) * HOUR}px`}
              style:height={`${((item.end - item.start) / 60) * HOUR}px`}
              style:left={`calc(${(item.column / item.columns) * 100}% + 2px)`}
              style:width={`calc(${100 / item.columns}% - 4px)`}
            >
              <button
                class={s.blockBody}
                data-short={item.end - item.start <= 30}
                data-task-id={item.task.id}
                aria-label="Edit or move {item.task.title ||
                  'block'}, {day.name}, {label(item.start)} to {label(
                  item.end,
                )}"
                onpointerdown={(event) =>
                  begin(event, index, item.task, "move")}
                onclick={(event) => {
                  if (event.detail === 0) edit(index, item.task);
                }}
                onkeydown={(event) => keyboard(event, index, item.task)}
              >
                <span class={s.blockTitle}
                  >{item.task.done ? "✓ " : ""}{item.task.title ||
                    "Untitled"}</span
                >
                {#if item.end - item.start >= 45}<span class={s.blockTime}
                    >{label(item.start)} – {label(item.end)}</span
                  >{/if}
              </button>
              <button
                class={s.handle}
                style:top="0"
                aria-label="Change start of {item.task.title}"
                onpointerdown={(event) =>
                  begin(event, index, item.task, "start")}
                onkeydown={(event) =>
                  keyboard(event, index, item.task, "start")}
              ></button>
              <button
                class={s.handle}
                style:bottom="0"
                aria-label="Change end of {item.task.title}"
                onpointerdown={(event) => begin(event, index, item.task, "end")}
                onkeydown={(event) => keyboard(event, index, item.task, "end")}
              ></button>
            </article>
          {/each}
          {#if gesture?.moved && gesture.day === index && gesture.nextStart !== null}
            <div
              class={s.ghost}
              style:top={`${(gesture.nextStart / 60) * HOUR}px`}
              style:height={`${((gesture.nextEnd - gesture.nextStart) / 60) * HOUR}px`}
            >
              {label(gesture.nextStart)}–{label(gesture.nextEnd)}
            </div>
          {/if}
        </div>
      {/each}
    </div>
  </div>
  <footer class={s.footer}>
    <span>{doneCount} / {allTasks.length} done</span><span role="status"
      >{message || "Drag to move · Pull edges to resize"}</span
    >
  </footer>
  {#if doc.error}<div class={s.error} role="alert">
      {doc.error}<button
        onclick={() => {
          if (doc.isReady) void doc.flush().catch(() => undefined);
          else void doc.reload();
        }}>Try again</button
      >
    </div>{/if}
</main>
<Dialog.Root bind:open={dialogOpen}>
  <Dialog.Portal
    ><Dialog.Overlay class={s.overlay} /><Dialog.Content class={s.dialog}>
      <Dialog.Title class={s.dialogTitle}
        >{editor?.source === -1 ? "Make some room" : "Edit block"}</Dialog.Title
      >
      <Dialog.Description class={s.description}
        >A little space for what matters.</Dialog.Description
      >
      {#if editor}
        <form
          onsubmit={(event) => {
            event.preventDefault();
            save();
          }}
        >
          <div class={s.fields}>
            <label class={s.field}
              >Title<input
                class={s.input}
                aria-label="Block title"
                bind:value={editor.task.title}
                placeholder="What’s happening?"
                required
              /></label
            >
            <div class={s.pair}>
              <div class={s.field}>
                <span>Day</span><Select.Root
                  type="single"
                  bind:value={editor.day}
                  items={dayItems}
                  ><Select.Trigger
                    type="button"
                    class={s.input}
                    aria-label="Block day"
                    >{dayItems.find((item) => item.value === editor?.day)
                      ?.label}</Select.Trigger
                  ><Select.Portal
                    ><Select.Content class={s.selectContent}
                      ><Select.Viewport
                        >{#each dayItems as item}<Select.Item
                            class={s.option}
                            value={item.value}
                            label={item.label}>{item.label}</Select.Item
                          >{/each}</Select.Viewport
                      ></Select.Content
                    ></Select.Portal
                  ></Select.Root
                >
              </div>
              <div class={s.field}>
                <span>Color</span><Select.Root
                  type="single"
                  value={editor.task.color ?? "sky"}
                  items={colorItems}
                  onValueChange={(value) => {
                    if (
                      editor &&
                      COLORS.includes(value as Task["color"] & string)
                    )
                      editor.task.color = value as Task["color"];
                  }}
                  ><Select.Trigger
                    type="button"
                    class={s.input}
                    aria-label="Block color"
                    >{editor.task.color ?? "sky"}</Select.Trigger
                  ><Select.Portal
                    ><Select.Content class={s.selectContent}
                      ><Select.Viewport
                        >{#each colorItems as item}<Select.Item
                            class={s.option}
                            value={item.value}
                            label={item.label}>{item.label}</Select.Item
                          >{/each}</Select.Viewport
                      ></Select.Content
                    ></Select.Portal
                  ></Select.Root
                >
              </div>
            </div>
            <label class={s.checkLabel}
              ><Checkbox.Root
                class={s.check}
                checked={editor.scheduled}
                onCheckedChange={(value) => {
                  if (editor) {
                    editor.scheduled = value === true;
                    if (editor.scheduled && minutes(editor.task.time) === null)
                      editor.task.time = "09:00";
                  }
                }}
                aria-label="Schedule a time"
                >{editor.scheduled ? "✓" : ""}</Checkbox.Root
              >Schedule a time</label
            >
            {#if editor.scheduled}<div class={s.pair}>
                <label class={s.field}
                  >Starts<input
                    class={s.input}
                    type="time"
                    step="900"
                    aria-label="Start time"
                    bind:value={editor.task.time}
                    required
                  /></label
                ><label class={s.field}
                  >Minutes<input
                    class={s.input}
                    type="number"
                    min="15"
                    max="1440"
                    step="15"
                    aria-label="Duration in minutes"
                    value={duration(editor.task)}
                    oninput={(event) => {
                      if (editor)
                        editor.task.durationMinutes =
                          event.currentTarget.valueAsNumber;
                    }}
                    required
                  /></label
                >
              </div>{/if}
            <label class={s.checkLabel}
              ><Checkbox.Root
                class={s.check}
                bind:checked={editor.task.done}
                aria-label="Block completed"
                >{editor.task.done ? "✓" : ""}</Checkbox.Root
              >Completed</label
            >
          </div>
          {#if formError}<p class={s.error} role="alert">{formError}</p>{/if}
          <div class={s.actions}>
            {#if editor.source >= 0}<button
                type="button"
                class={s.danger}
                onclick={remove}>Delete</button
              >{/if}<Dialog.Close type="button" class={s.button}
              >Cancel</Dialog.Close
            ><button type="submit" class={s.primary}>Save block</button>
          </div>
        </form>
      {/if}
    </Dialog.Content></Dialog.Portal
  >
</Dialog.Root>
<IconTarget><Icon done={doneCount} total={allTasks.length} /></IconTarget>
<ExportTarget><Export data={doc.current} /></ExportTarget>
