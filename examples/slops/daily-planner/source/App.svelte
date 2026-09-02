<script lang="ts">
  import { capture } from "@hitslop/runtime";
  import { jsonStore } from "@hitslop/svelte";
  import Check from "@lucide/svelte/icons/check";
  import Plus from "@lucide/svelte/icons/plus";
  import Trash2 from "@lucide/svelte/icons/trash-2";
  import { onDestroy, tick } from "svelte";
  import Icon from "./Icon.svelte";

  type Kind = "focus" | "meeting" | "break" | "personal";
  type Block = { id: string; start: string; end: string; title: string; kind: Kind };
  type Priority = { text: string; done: boolean };
  type Planner = { date: string; priorities: [Priority, Priority, Priority]; blocks: Block[]; notes: string };

  const DAY_START = 6 * 60;
  const DAY_END = 24 * 60;
  const SNAP = 15;
  const HOURS = Array.from({ length: (DAY_END - DAY_START) / 60 }, (_, index) => DAY_START + index * 60);
  const KINDS: Kind[] = ["focus", "meeting", "break", "personal"];

  const planner = jsonStore<Planner>({
    date: today(),
    priorities: [
      { text: "Finish the quarterly summary", done: false },
      { text: "Call the framer back", done: true },
      { text: "", done: false },
    ],
    blocks: [
      { id: "reading", start: "07:00", end: "08:00", title: "Reading and coffee", kind: "personal" },
      { id: "summary", start: "09:00", end: "11:00", title: "Quarterly summary — first pass", kind: "focus" },
      { id: "standup", start: "11:00", end: "11:30", title: "Team stand-up", kind: "meeting" },
      { id: "lunch", start: "12:30", end: "13:15", title: "Lunch away from the desk", kind: "break" },
      { id: "framer", start: "14:00", end: "14:30", title: "Call the framer", kind: "meeting" },
      { id: "edits", start: "15:00", end: "17:00", title: "Edits and inbox", kind: "focus" },
      { id: "swim", start: "18:30", end: "19:30", title: "Swim", kind: "personal" },
    ],
    notes: "Book the van for Saturday. Ask about the delivery window before confirming.",
  });

  let now = $state(new Date());
  const clock = setInterval(() => { now = new Date(); }, 30_000);

  const isToday = $derived(planner.current.date === localDate(now));
  const nowMinutes = $derived(now.getHours() * 60 + now.getMinutes());
  const showNow = $derived(isToday && nowMinutes >= DAY_START && nowMinutes <= DAY_END);
  const weekday = $derived(formatDate(planner.current.date, { weekday: "long" }));
  const longDate = $derived(formatDate(planner.current.date, { day: "numeric", month: "long", year: "numeric" }));
  const placed = $derived(layout(planner.current.blocks));
  const bookedMinutes = $derived(placed.reduce((total, item) => total + (item.end - item.start), 0));

  function today(): string { return localDate(new Date()); }
  function localDate(value: Date): string {
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
  }
  function formatDate(value: string, options: Intl.DateTimeFormatOptions): string {
    const parsed = new Date(`${value}T00:00:00`);
    return Number.isNaN(parsed.valueOf()) ? "—" : parsed.toLocaleDateString(undefined, options);
  }
  function toMinutes(value: string): number {
    const [hours, minutes] = value.split(":").map(Number);
    return Number.isFinite(hours) && Number.isFinite(minutes) ? (hours ?? 0) * 60 + (minutes ?? 0) : DAY_START;
  }
  function toClock(minutes: number): string {
    const wrapped = ((minutes % 1440) + 1440) % 1440;
    return `${String(Math.floor(wrapped / 60)).padStart(2, "0")}:${String(wrapped % 60).padStart(2, "0")}`;
  }
  function toLabel(minutes: number): string {
    const hour = Math.floor(minutes / 60);
    const suffix = hour < 12 ? "am" : "pm";
    const shown = hour % 12 === 0 ? 12 : hour % 12;
    return minutes % 60 === 0 ? `${shown} ${suffix}` : `${shown}:${String(minutes % 60).padStart(2, "0")} ${suffix}`;
  }
  function clampDay(minutes: number): number { return Math.min(Math.max(minutes, DAY_START), DAY_END); }
  function offsetOf(minutes: number): number { return (clampDay(minutes) - DAY_START) / 60; }
  // The day ends at midnight, which a clock writes as 00:00, so an end at or before the
  // start belongs to the far edge of the rail rather than the small hours of the morning.
  function rangeOf(block: Block): { start: number; end: number } {
    const start = clampDay(toMinutes(block.start));
    const raw = toMinutes(block.end);
    const end = raw <= start ? raw + 1440 : raw;
    return { start, end: Math.min(Math.max(end, start + SNAP), DAY_END) };
  }

  type Placed = { block: Block; start: number; end: number; column: number; columns: number };
  function layout(blocks: Block[]): Placed[] {
    const items = blocks
      .map((block) => ({ block, ...rangeOf(block) }))
      .sort((a, b) => a.start - b.start || a.end - b.end);

    const output: Placed[] = [];
    let cluster: typeof items = [];
    let clusterEnd = Number.NEGATIVE_INFINITY;
    const flush = (): void => {
      const columnEnds: number[] = [];
      const seats = cluster.map((item) => {
        let column = columnEnds.findIndex((end) => end <= item.start);
        if (column === -1) column = columnEnds.length;
        columnEnds[column] = item.end;
        return { item, column };
      });
      for (const { item, column } of seats) output.push({ ...item, column, columns: columnEnds.length });
      cluster = [];
      clusterEnd = Number.NEGATIVE_INFINITY;
    };
    for (const item of items) {
      if (cluster.length > 0 && item.start >= clusterEnd) flush();
      cluster.push(item);
      clusterEnd = Math.max(clusterEnd, item.end);
    }
    if (cluster.length > 0) flush();
    return output;
  }

  // Pointer editing. The rail is the ruler: every gesture converts a screen Y into a
  // quarter-hour so drawing, moving, and stretching all land on the same grid.
  let fieldEl = $state<HTMLDivElement | null>(null);
  let draft = $state<{ start: number; end: number } | null>(null);
  let activeID = $state<string | null>(null);
  let draftAnchor = DAY_START;
  let grab: { id: string; mode: "move" | "start" | "end"; origin: number; start: number; end: number } | null = null;

  function minutesAt(clientY: number): number {
    if (!fieldEl) return DAY_START;
    const rect = fieldEl.getBoundingClientRect();
    const perHour = rect.height / HOURS.length || 1;
    return clampDay(Math.round((DAY_START + ((clientY - rect.top) / perHour) * 60) / SNAP) * SNAP);
  }
  function blockByID(id: string): Block | undefined {
    return planner.current.blocks.find((block) => block.id === id);
  }
  async function createBlock(start: number, end: number): Promise<void> {
    const id = crypto.randomUUID();
    planner.current.blocks.push({ id, start: toClock(start), end: toClock(end), title: "New block", kind: "focus" });
    await tick();
    document.querySelector<HTMLInputElement>(`[data-title-for="${id}"]`)?.select();
  }

  function startDraft(event: PointerEvent): void {
    if (event.button !== 0) return;
    draftAnchor = Math.min(minutesAt(event.clientY), DAY_END - SNAP);
    draft = { start: draftAnchor, end: draftAnchor + SNAP };
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    event.preventDefault();
  }
  function moveDraft(event: PointerEvent): void {
    if (!draft) return;
    const at = minutesAt(event.clientY);
    draft = { start: Math.min(draftAnchor, at), end: Math.max(draftAnchor + SNAP, at) };
  }
  function endDraft(): void {
    if (!draft) return;
    let { start, end } = draft;
    draft = null;
    // A tap without travel means "an hour here", which is the common case.
    if (end - start <= SNAP) {
      start = Math.min(start, DAY_END - 60);
      end = start + 60;
    }
    void createBlock(start, end);
  }
  function cancelDraft(): void { draft = null; }

  function startGrab(event: PointerEvent, block: Block, mode: "move" | "start" | "end"): void {
    if (event.button !== 0) return;
    grab = { id: block.id, mode, origin: minutesAt(event.clientY), ...rangeOf(block) };
    activeID = block.id;
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    event.preventDefault();
  }
  function moveGrab(event: PointerEvent): void {
    if (!grab) return;
    const block = blockByID(grab.id);
    if (!block) return;
    const delta = minutesAt(event.clientY) - grab.origin;
    if (grab.mode === "move") {
      const span = Math.min(grab.end - grab.start, DAY_END - DAY_START);
      const start = Math.min(Math.max(grab.start + delta, DAY_START), DAY_END - span);
      block.start = toClock(start);
      block.end = toClock(start + span);
    } else if (grab.mode === "start") {
      block.start = toClock(Math.min(clampDay(grab.start + delta), grab.end - SNAP));
    } else {
      block.end = toClock(Math.max(clampDay(grab.end + delta), grab.start + SNAP));
    }
  }
  function endGrab(): void { grab = null; activeID = null; }
  function nudge(event: KeyboardEvent, block: Block, mode: "move" | "start" | "end"): void {
    const step = event.key === "ArrowUp" ? -SNAP : event.key === "ArrowDown" ? SNAP : 0;
    if (step === 0) return;
    event.preventDefault();
    const { start, end } = rangeOf(block);
    if (mode === "move") {
      const next = Math.min(Math.max(start + step, DAY_START), DAY_END - (end - start));
      block.start = toClock(next);
      block.end = toClock(next + (end - start));
    } else if (mode === "start") {
      block.start = toClock(Math.min(clampDay(start + step), end - SNAP));
    } else {
      block.end = toClock(Math.max(clampDay(end + step), start + SNAP));
    }
  }

  function addBlock(): void {
    const latest = planner.current.blocks.reduce((end, block) => Math.max(end, rangeOf(block).end), 8 * 60);
    const start = Math.min(Math.max(latest, DAY_START), DAY_END - 60);
    void createBlock(start, start + 60);
  }
  function removeBlock(id: string): void { planner.current.blocks = planner.current.blocks.filter((block) => block.id !== id); }
  function goToToday(): void { planner.current.date = today(); }

  onDestroy(() => { clearInterval(clock); planner.destroy(); });
</script>

<main class="planner-canvas" data-slop-selection="none">
  <article class="page">
    <header class="masthead">
      <div class="masthead-copy">
        <p class="wordmark">Daily Planner</p>
        <h1>{weekday}</h1>
        <p class="longdate">{longDate}</p>
      </div>
      <div class="masthead-side">
        <label class="date-field" data-slop-export="hide">
          <span>Date</span>
          <input type="date" aria-label="Planner date" bind:value={planner.current.date} />
        </label>
        <div class="masthead-meters">
          <p class="booked"><b>{Math.floor(bookedMinutes / 60)}</b><small>h</small><b>{String(bookedMinutes % 60).padStart(2, "0")}</b><small>m</small></p>
          <p class="booked-label">Blocked out</p>
        </div>
        {#if !isToday}
          <button type="button" class="today-jump" data-slop-export="hide" onclick={goToToday}>Back to today</button>
        {/if}
      </div>
    </header>

    <section class="priorities" aria-labelledby="priorities-heading">
      <h2 id="priorities-heading">The top three</h2>
      <ol>
        {#each planner.current.priorities as priority, index (index)}
          <li class:priority-done={priority.done}>
            <button
              type="button"
              class="priority-rank"
              aria-pressed={priority.done}
              aria-label="Mark priority {index + 1} done"
              onclick={() => { priority.done = !priority.done; }}
            >{#if priority.done}<Check />{:else}{index + 1}{/if}</button>
            <input aria-label="Priority {index + 1}" placeholder="Priority {index + 1}" bind:value={priority.text} />
          </li>
        {/each}
      </ol>
    </section>

    <section class="schedule" aria-labelledby="schedule-heading">
      <div class="schedule-head">
        <h2 id="schedule-heading">Hours</h2>
        <p class="legend" aria-hidden="true">
          {#each KINDS as kind (kind)}<span class="legend-key" data-kind={kind}>{kind}</span>{/each}
        </p>
        <button type="button" class="add-block" data-slop-export="hide" onclick={addBlock}><Plus />Add block</button>
      </div>

      <div class="rail" style="--hours: {HOURS.length}">
        <div class="gutter" aria-hidden="true">
          {#each HOURS as hour (hour)}<span>{toLabel(hour)}</span>{/each}
        </div>
        <div class="field" class:field-live={draft !== null || activeID !== null} bind:this={fieldEl}>
          <button
            type="button"
            class="field-sheet"
            data-slop-export="hide"
            aria-label="Add a time block. Drag down the rail to set its hours."
            onpointerdown={startDraft}
            onpointermove={moveDraft}
            onpointerup={endDraft}
            onpointercancel={cancelDraft}
            onkeydown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); addBlock(); } }}
          ></button>

          {#each placed as item (item.block.id)}
            {@const span = offsetOf(item.end) - offsetOf(item.start)}
            <article
              class="block"
              class:block-active={activeID === item.block.id}
              data-kind={item.block.kind}
              data-compact={span < 1.25}
              data-tight={span < 0.85}
              data-past={isToday && item.end <= nowMinutes}
              style="--top: {offsetOf(item.start)}; --span: {span}; --column: {item.column}; --columns: {item.columns}"
            >
              <button
                type="button"
                class="block-bar"
                aria-label="Move {item.block.title}"
                onpointerdown={(event) => startGrab(event, item.block, "move")}
                onpointermove={moveGrab}
                onpointerup={endGrab}
                onpointercancel={endGrab}
                onkeydown={(event) => nudge(event, item.block, "move")}
              ></button>
              <div class="block-copy">
                <input class="block-title" data-title-for={item.block.id} aria-label="Block title" bind:value={item.block.title} />
                <span class="block-time">{toLabel(item.start)} – {toLabel(item.end)}</span>
              </div>
              <button
                type="button"
                class="block-handle block-handle-start"
                data-slop-export="hide"
                aria-label="Change start of {item.block.title}"
                onpointerdown={(event) => startGrab(event, item.block, "start")}
                onpointermove={moveGrab}
                onpointerup={endGrab}
                onpointercancel={endGrab}
                onkeydown={(event) => nudge(event, item.block, "start")}
              ></button>
              <button
                type="button"
                class="block-handle block-handle-end"
                data-slop-export="hide"
                aria-label="Change end of {item.block.title}"
                onpointerdown={(event) => startGrab(event, item.block, "end")}
                onpointermove={moveGrab}
                onpointerup={endGrab}
                onpointercancel={endGrab}
                onkeydown={(event) => nudge(event, item.block, "end")}
              ></button>
              <div class="block-tools" data-slop-export="hide">
                <input type="time" aria-label="{item.block.title} start time" bind:value={item.block.start} />
                <span aria-hidden="true">–</span>
                <input type="time" aria-label="{item.block.title} end time" bind:value={item.block.end} />
                <select aria-label="{item.block.title} kind" bind:value={item.block.kind}>
                  {#each KINDS as kind (kind)}<option value={kind}>{kind}</option>{/each}
                </select>
                <button type="button" aria-label="Remove {item.block.title}" onclick={() => removeBlock(item.block.id)}><Trash2 /></button>
              </div>
            </article>
          {/each}

          {#if draft}
            <div class="draft" data-slop-export="hide" style="--top: {offsetOf(draft.start)}; --span: {offsetOf(draft.end) - offsetOf(draft.start)}">
              <span>{toLabel(draft.start)} – {toLabel(draft.end)}</span>
            </div>
          {/if}

          {#if showNow}
            <div class="now" style="--top: {offsetOf(nowMinutes)}" aria-label="Current time {toLabel(nowMinutes)}">
              <span class="now-tag">{toLabel(nowMinutes)}</span>
            </div>
          {/if}
        </div>
      </div>
    </section>

    <section class="notes" aria-labelledby="notes-heading">
      <h2 id="notes-heading">Notes</h2>
      <textarea aria-label="Notes for the day" placeholder="Anything to carry into tomorrow" bind:value={planner.current.notes}></textarea>
    </section>

    {#if planner.error}<p class="friendly-error" data-slop-export="hide">Your latest changes couldn’t be saved.</p>{/if}
  </article>
</main>

{#if capture.isRenderer()}
  <Icon />
{/if}
