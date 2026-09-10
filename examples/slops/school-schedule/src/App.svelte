<script lang="ts">
  import { ready } from "@hitslop/runtime";
  import { jsonStore, IconTarget, ExportTarget } from "@hitslop/svelte";
  import { Dialog, RadioGroup } from "bits-ui";
  import { onDestroy } from "svelte";
  import Plus from "@lucide/svelte/icons/plus";
  import ArrowUpRight from "@lucide/svelte/icons/arrow-up-right";
  import Bell from "@lucide/svelte/icons/bell";
  import Settings2 from "@lucide/svelte/icons/settings-2";
  import Copy from "@lucide/svelte/icons/copy";
  import Star from "@lucide/svelte/icons/star";
  import Check from "@lucide/svelte/icons/check";
  import Eye from "@lucide/svelte/icons/eye";
  import EyeOff from "@lucide/svelte/icons/eye-off";
  import schema, {
    DAYS,
    COLORS,
    isDay,
    isColor,
    isBreakName,
    type ClassEntry,
    type PeriodSlot,
    type ActivityEntry,
    type DayKey,
  } from "../schema";
  import { initial } from "./initial";
  import {
    DAY_NAMES,
    COLOR_NAMES,
    clockLabel,
    sortedPeriods,
    periodError,
    validTimes,
    moveClass,
    copyDay,
    liveStatus,
  } from "./schedule";
  import Choice from "./Choice.svelte";
  import Export from "./Export.svelte";
  import Icon from "./Icon.svelte";
  import * as s from "./styles.css";
  const doc = jsonStore({ schema, initial });
  $effect(() => {
    if (doc.isReady) ready();
  });
  onDestroy(() => doc.destroy());
  let now = $state(new Date());
  $effect(() => {
    const update = () => {
      now = new Date();
    };
    const interval = setInterval(update, 30000);
    const visible = () => {
      if (document.visibilityState === "visible") update();
    };
    document.addEventListener("visibilitychange", visible);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", visible);
    };
  });
  const status = $derived(liveStatus(doc.current, now));
  const periods = $derived(sortedPeriods(doc.current.periods));
  const days = DAYS.map((value) => ({ value, label: DAY_NAMES[value] }));
  const periodItems = $derived(
    periods.map((p) => ({
      value: p.id,
      label: `${p.name} · ${clockLabel(p.start)}`,
    })),
  );
  let modal = $state<"class" | "period" | "activity" | "details" | "copy">(
    "class",
  );
  let open = $state(false),
    fresh = $state(false),
    error = $state(""),
    confirmDelete = $state(false),
    confirmCopy = $state(false),
    showLocker = $state(false);
  let entry = $state<ClassEntry>({
    id: "",
    day: "MON",
    periodId: "",
    subject: "",
    room: "",
    teacher: "",
    color: "slate",
  });
  let period = $state<PeriodSlot>({
    id: "",
    name: "",
    start: "08:00",
    end: "08:50",
  });
  let activity = $state<ActivityEntry>({
    id: "",
    day: "MON",
    start: "15:30",
    end: "17:00",
    title: "",
    location: "",
  });
  let details = $state({ studentName: "", term: "", homeroom: "", locker: "" });
  let copyFrom = $state("MON");
  let origin: HTMLElement | null = null;
  const title = $derived(
    modal === "class"
      ? fresh
        ? "Add a class"
        : "Your class"
      : modal === "period"
        ? fresh
          ? "Add a period"
          : "Bell times"
        : modal === "activity"
          ? fresh
            ? "After-class plans"
            : "Edit your plans"
          : modal === "copy"
            ? "Build out your week"
            : "Make it yours",
  );
  function begin(kind: typeof modal, event?: Event) {
    origin =
      (event?.currentTarget as HTMLElement) ||
      (document.activeElement as HTMLElement);
    modal = kind;
    error = "";
    confirmDelete = false;
    confirmCopy = false;
    open = true;
  }
  function getClass(day: DayKey, id: string) {
    return doc.current.classes.find((c) => c.day === day && c.periodId === id);
  }
  function editClass(day: DayKey, periodId: string, event?: Event) {
    const c = getClass(day, periodId);
    fresh = !c;
    entry = c
      ? { ...c }
      : {
          id: crypto.randomUUID(),
          day,
          periodId,
          subject: "",
          room: "",
          teacher: "",
          color: "slate",
        };
    begin("class", event);
  }
  function editPeriod(p?: PeriodSlot, event?: Event) {
    fresh = !p;
    const last = periods.at(-1);
    const start = last?.end || "08:00";
    const [h, m] = start.split(":").map(Number);
    const end = Math.min(h * 60 + m + 50, 1439);
    period = p
      ? { ...p }
      : {
          id: crypto.randomUUID(),
          name: `Period ${periods.length + 1}`,
          start,
          end: `${String(Math.floor(end / 60)).padStart(2, "0")}:${String(end % 60).padStart(2, "0")}`,
        };
    begin("period", event);
  }
  function editActivity(day: DayKey, a?: ActivityEntry, event?: Event) {
    fresh = !a;
    activity = a
      ? { ...a }
      : {
          id: crypto.randomUUID(),
          day,
          start: "15:30",
          end: "17:00",
          title: "",
          location: "",
        };
    begin("activity", event);
  }
  function editDetails(event: Event) {
    details = {
      studentName: doc.current.studentName,
      term: doc.current.term,
      homeroom: doc.current.homeroom,
      locker: doc.current.locker,
    };
    showLocker = false;
    begin("details", event);
  }
  const destination = $derived(getClass(entry.day, entry.periodId));
  const willSwap = $derived(destination && destination.id !== entry.id);
  function save(event: SubmitEvent) {
    event.preventDefault();
    error = "";
    if (modal === "class") {
      if (!entry.subject.trim()) {
        error = "Give this class a name.";
        return;
      }
      if (
        !isDay(entry.day) ||
        !isColor(entry.color) ||
        !doc.current.periods.some((p) => p.id === entry.periodId)
      ) {
        error = "Choose a day and period.";
        return;
      }
      if (fresh) {
        if (destination) {
          error = "That slot is occupied. Choose an empty slot.";
          return;
        }
        doc.current.classes.push({ ...entry, subject: entry.subject.trim() });
      } else {
        doc.current.classes = moveClass(
          doc.current.classes,
          entry.id,
          entry.day,
          entry.periodId,
        ).map((c) =>
          c.id === entry.id
            ? { ...c, ...entry, subject: entry.subject.trim() }
            : c,
        );
      }
    } else if (modal === "period") {
      error = periodError(period, doc.current.periods);
      if (error) return;
      if (fresh) doc.current.periods.push({ ...period });
      else {
        const p = doc.current.periods.find((p) => p.id === period.id);
        if (p) Object.assign(p, period);
      }
    } else if (modal === "activity") {
      if (!activity.title.trim()) {
        error = "Give your plan a title.";
        return;
      }
      if (!isDay(activity.day) || !validTimes(activity.start, activity.end)) {
        error = "Choose a day and an end time after the start time.";
        return;
      }
      if (fresh) doc.current.activities.push({ ...activity });
      else {
        const a = doc.current.activities.find((a) => a.id === activity.id);
        if (a) Object.assign(a, activity);
      }
    } else if (modal === "details") {
      Object.assign(doc.current, details);
    } else if (modal === "copy") {
      if (!isDay(copyFrom)) return;
      if (!confirmCopy && doc.current.classes.some((c) => c.day !== copyFrom)) {
        confirmCopy = true;
        return;
      }
      doc.current.classes = copyDay(doc.current.classes, copyFrom, () =>
        crypto.randomUUID(),
      );
    }
    open = false;
  }
  function remove() {
    if (modal === "class")
      doc.current.classes = doc.current.classes.filter(
        (c) => c.id !== entry.id,
      );
    if (modal === "activity")
      doc.current.activities = doc.current.activities.filter(
        (a) => a.id !== activity.id,
      );
    if (modal === "period") {
      if (
        !confirmDelete &&
        doc.current.classes.some((c) => c.periodId === period.id)
      ) {
        confirmDelete = true;
        return;
      }
      doc.current.periods = doc.current.periods.filter(
        (p) => p.id !== period.id,
      );
      doc.current.classes = doc.current.classes.filter(
        (c) => c.periodId !== period.id,
      );
    }
    open = false;
  }
  function restoreFocus(event: Event) {
    event.preventDefault();
    (origin?.isConnected
      ? origin
      : document.querySelector<HTMLElement>("[data-details]")
    )?.focus({ preventScroll: true });
  }
  let scroller: HTMLDivElement;
  let drag = $state<{
    id: string;
    day: DayKey;
    periodId: string;
    x: number;
    y: number;
    moved: boolean;
  } | null>(null);
  let target = $state<{ day: DayKey; periodId: string } | null>(null);
  let pointerX = 0,
    pointerY = 0,
    raf = 0;
  const dragLabel = $derived(
    target && drag
      ? getClass(target.day, target.periodId)?.id === drag.id
        ? "Keep here"
        : getClass(target.day, target.periodId)
          ? `Swap with ${getClass(target.day, target.periodId)?.subject}`
          : `Move to ${DAY_NAMES[target.day]}`
      : "",
  );
  function startDrag(event: PointerEvent, c: ClassEntry) {
    if (event.button !== 0) return;
    drag = {
      id: c.id,
      day: c.day,
      periodId: c.periodId,
      x: event.clientX,
      y: event.clientY,
      moved: false,
    };
    pointerX = event.clientX;
    pointerY = event.clientY;
    target = null;
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    event.preventDefault();
    raf = requestAnimationFrame(autoScroll);
  }
  function updateTarget() {
    const cell = document
      .elementFromPoint(pointerX, pointerY)
      ?.closest<HTMLElement>("[data-slot-day]");
    target =
      cell && isDay(cell.dataset.slotDay || "")
        ? {
            day: cell.dataset.slotDay as DayKey,
            periodId: cell.dataset.slotPeriod!,
          }
        : null;
  }
  function moveDrag(event: PointerEvent) {
    if (!drag) return;
    pointerX = event.clientX;
    pointerY = event.clientY;
    if (Math.hypot(pointerX - drag.x, pointerY - drag.y) > 5) drag.moved = true;
    if (drag.moved) updateTarget();
  }
  function autoScroll() {
    if (!drag) return;
    if (drag.moved && scroller) {
      const r = scroller.getBoundingClientRect();
      scroller.scrollBy(
        pointerX < r.left + 35 ? -6 : pointerX > r.right - 35 ? 6 : 0,
        pointerY < r.top + 45 ? -6 : pointerY > r.bottom - 35 ? 6 : 0,
      );
      updateTarget();
    }
    raf = requestAnimationFrame(autoScroll);
  }
  function cancelDrag() {
    cancelAnimationFrame(raf);
    drag = null;
    target = null;
  }
  function endDrag(event: PointerEvent) {
    if (!drag) return;
    const d = drag,
      t = target;
    cancelDrag();
    if (d.moved) {
      if (t)
        doc.current.classes = moveClass(
          doc.current.classes,
          d.id,
          t.day,
          t.periodId,
        );
    } else editClass(d.day, d.periodId, event);
  }
  onDestroy(() => cancelAnimationFrame(raf));
</script>

<svelte:window
  onkeydown={(e) => {
    if (e.key === "Escape") cancelDrag();
  }}
/>
<main
  class={s.canvas}
  aria-label="School schedule"
  aria-busy={doc.isLoading}
  data-slop-selection="none"
>
  <div class={s.app} inert={!doc.isReady || doc.isLoading}>
    <header class={s.header}>
      <div class={s.identity}>
        <span class={s.eyebrow}>SCHOOL / SCHEDULE</span><button
          class={s.nameButton}
          data-details
          onclick={editDetails}
          aria-label="Edit student details"
          ><h1 class={s.name}>{doc.current.studentName || "Your week"}</h1>
          <ArrowUpRight size={20} /></button
        >
        <p class={s.term}>{doc.current.term || "Make this term yours."}</p>
      </div>
      <div class={s.live} aria-label="Current schedule status">
        <span class={s.statusLabel}><Bell size={13} />{status.label}</span
        ><strong class={s.liveTitle}>{status.title}</strong><span
          class={s.liveDetail}>{status.detail}</span
        >{#if status.next}<span class={s.upNext}>{status.next}</span>{/if}
      </div>
    </header>
    <div class={s.toolbar}>
      <div class={s.boardHeading}>
        <span class={s.starMark} aria-hidden="true"><Star size={17} /></span>
        <h2 class={s.heading}>A week of possibilities.</h2>
      </div>
      <div class={s.tools}>
        <button
          class={s.tool}
          onclick={(e) => {
            copyFrom = status.day || "MON";
            begin("copy", e);
          }}><Copy size={13} /> Copy day</button
        ><button class={s.tool} onclick={(e) => editPeriod(undefined, e)}
          ><Plus size={14} /> Period</button
        >
      </div>
    </div>
    <div class={s.scroller} bind:this={scroller}>
      <div class={s.board} role="region" aria-label="Weekly timetable">
        <div class={s.dayRow}>
          <div class={s.corner}>BELL TIMES</div>
          {#each DAYS as day}<div
              class={s.dayHead}
              data-today={status.day === day}
            >
              {DAY_NAMES[day]}{#if status.day === day}<span class={s.todayBadge}
                  >TODAY</span
                >{/if}
            </div>{/each}
        </div>
        {#each periods as p (p.id)}<div class={s.periodRow}>
            <button
              class={s.periodCell}
              onclick={(e) => editPeriod(p, e)}
              aria-label="Edit {p.name} bell times"
              ><strong>{p.name}</strong><span
                >{clockLabel(p.start)}<br />{clockLabel(p.end)}</span
              ></button
            >
            {#each DAYS as day}{@const c = getClass(day, p.id)}{@const nowCell =
                status.day === day && status.periodId === p.id}
              <div
                class={s.slot}
                data-slot-day={day}
                data-slot-period={p.id}
                data-target={drag?.moved &&
                  target?.day === day &&
                  target?.periodId === p.id}
                data-today={status.day === day}
              >
                {#if c}<button
                    class={s.classTile}
                    data-color={c.color}
                    data-now={nowCell}
                    data-dragging={drag?.id === c.id && drag.moved}
                    onpointerdown={(e) => startDrag(e, c)}
                    onpointermove={moveDrag}
                    onpointerup={endDrag}
                    onpointercancel={cancelDrag}
                    onclick={(e) => {
                      if (e.detail === 0) editClass(day, p.id, e);
                    }}
                    aria-label="Edit {c.subject || 'class'}, {DAY_NAMES[
                      day
                    ]}, {p.name}"
                    title="{c.subject} · {c.room} · {c.teacher}"
                    ><strong class={s.subject}
                      >{c.subject || "Untitled class"}</strong
                    ><span class={s.room}>{c.room || "Room to be added"}</span
                    >{#if nowCell}<span class={s.nowBadge}>NOW</span
                      >{/if}</button
                  >
                {:else}<button
                    class={s.emptySlot}
                    onclick={(e) => editClass(day, p.id, e)}
                    aria-label="Add class on {DAY_NAMES[day]}, {p.name}"
                    ><Plus size={13} /><span
                      >{isBreakName(p.name) ? p.name : "Free"}</span
                    ></button
                  >{/if}
                {#if drag?.moved && target?.day === day && target?.periodId === p.id}<span
                    class={s.dropLabel}>{dragLabel}</span
                  >{/if}
              </div>{/each}
          </div>
        {:else}<div class={s.emptyBoard}>
            <Star size={28} />
            <h2>Your next chapter starts here.</h2>
            <p>Add your bell times, then give each class a place.</p>
            <button class={s.primary} onclick={(e) => editPeriod(undefined, e)}
              >Add first period</button
            >
          </div>{/each}
        <div class={s.afterHeading}>
          <h2 class={s.heading}>After class</h2>
          <span>Clubs, practice & your kind of plans.</span>
        </div>
        <div class={s.afterGrid}>
          <div class={s.afterCorner} aria-hidden="true">
            <ArrowUpRight size={24} />
          </div>
          {#each DAYS as day}<section
              class={s.activityColumn}
              aria-label="{DAY_NAMES[day]} after class"
            >
              {#each doc.current.activities
                .filter((a) => a.day === day)
                .sort( (a, b) => a.start.localeCompare(b.start) ) as a (a.id)}<button
                  class={s.activityTile}
                  onclick={(e) => editActivity(day, a, e)}
                  ><strong>{a.title || "Your plans"}</strong><span
                    >{clockLabel(a.start)} · {a.location ||
                      "Location TBD"}</span
                  ></button
                >{/each}<button
                class={s.addActivity}
                onclick={(e) => editActivity(day, undefined, e)}
                aria-label="Add after-class plan on {DAY_NAMES[day]}"
                ><Plus size={12} /> Add plan</button
              >
            </section>{/each}
        </div>
      </div>
    </div>
    <footer class={s.footer}>
      <span
        >{doc.current.homeroom
          ? `Homeroom · ${doc.current.homeroom}`
          : "Your week. Your rhythm."}</span
      ><button class={s.footerButton} onclick={editDetails}
        ><Settings2 size={12} /> My details</button
      >
    </footer>
  </div>
  {#if doc.error}<p class={s.error} role="alert">
      {doc.error}<button
        onclick={() => {
          if (doc.isReady) void doc.flush().catch(() => undefined);
          else void doc.reload();
        }}>Try again</button
      >
    </p>{/if}
  <div class={s.srOnly} aria-live="polite">{drag?.moved ? dragLabel : ""}</div>
</main>
<Dialog.Root bind:open
  ><Dialog.Portal
    ><Dialog.Overlay class={s.overlay} /><Dialog.Content
      class={s.dialog}
      onCloseAutoFocus={restoreFocus}
      ><Dialog.Title class={s.dialogTitle}>{title}</Dialog.Title
      ><Dialog.Description class={s.description}
        >{modal === "class"
          ? "The essentials, all in one place."
          : modal === "copy"
            ? "Repeat one day’s classes across the other four weekdays."
            : modal === "period"
              ? "Bell times apply to every weekday."
              : modal === "activity"
                ? "Make room for the good stuff after class."
                : "A schedule that feels like you."}</Dialog.Description
      >
      <form class={s.form} onsubmit={save}>
        {#if modal === "class"}
          <label class={s.formLabel}
            >Subject<input
              class={s.input}
              bind:value={entry.subject}
              placeholder="Biology, studio, something new…"
              required
            /></label
          >
          <div class={s.formRow}>
            <label class={s.formLabel}
              >Room<input
                class={s.input}
                bind:value={entry.room}
                placeholder="Room or building"
              /></label
            ><label class={s.formLabel}
              >Teacher<input
                class={s.input}
                bind:value={entry.teacher}
                placeholder="Name"
              /></label
            >
          </div>
          <div class={s.formRow}>
            <Choice label="Day" bind:value={entry.day} items={days} /><Choice
              label="Period"
              bind:value={entry.periodId}
              items={periodItems}
            />
          </div>
          {#if willSwap}<p class={s.notice}>
              {fresh
                ? "This slot is occupied."
                : `Saving swaps places with ${destination?.subject || "the class in this slot"}.`}
            </p>{/if}
          <div class={s.formLabel}>
            <span>Subject color</span><RadioGroup.Root
              class={s.palette}
              bind:value={entry.color}
              aria-label="Subject color"
              >{#each COLORS as color}<RadioGroup.Item
                  class={s.colorOption}
                  value={color}
                  data-color={color}
                  aria-label={COLOR_NAMES[color]}
                  title={COLOR_NAMES[color]}
                  >{#if entry.color === color}<Check
                      size={17}
                    />{/if}</RadioGroup.Item
                >{/each}</RadioGroup.Root
            >
          </div>
        {:else if modal === "period"}
          <label class={s.formLabel}
            >Period name<input
              class={s.input}
              bind:value={period.name}
              required
            /></label
          >
          <div class={s.formRow}>
            <label class={s.formLabel}
              >Starts<input
                type="time"
                class={s.input}
                bind:value={period.start}
                required
              /></label
            ><label class={s.formLabel}
              >Ends<input
                type="time"
                class={s.input}
                bind:value={period.end}
                required
              /></label
            >
          </div>
          {#if confirmDelete}<p class={s.notice} role="alert">
              Remove this period and all {doc.current.classes.filter(
                (c) => c.periodId === period.id,
              ).length} classes in it? This cannot be undone.
            </p>{/if}
        {:else if modal === "activity"}
          <label class={s.formLabel}
            >Plan<input
              class={s.input}
              bind:value={activity.title}
              placeholder="Robotics club, practice, coffee…"
              required
            /></label
          ><Choice label="Day" bind:value={activity.day} items={days} />
          <div class={s.formRow}>
            <label class={s.formLabel}
              >Starts<input
                type="time"
                class={s.input}
                bind:value={activity.start}
                required
              /></label
            ><label class={s.formLabel}
              >Ends<input
                type="time"
                class={s.input}
                bind:value={activity.end}
                required
              /></label
            >
          </div>
          <label class={s.formLabel}
            >Location<input
              class={s.input}
              bind:value={activity.location}
              placeholder="Where to meet"
            /></label
          >
        {:else if modal === "details"}
          <label class={s.formLabel}
            >Student name<input
              class={s.input}
              bind:value={details.studentName}
              placeholder="Your name"
            /></label
          ><label class={s.formLabel}
            >Term<input
              class={s.input}
              bind:value={details.term}
              placeholder="Fall semester"
            /></label
          ><label class={s.formLabel}
            >Homeroom<input
              class={s.input}
              bind:value={details.homeroom}
              placeholder="Room · teacher"
            /></label
          ><label class={s.formLabel}
            >Locker number & combination<input
              class={s.input}
              type={showLocker ? "text" : "password"}
              bind:value={details.locker}
              autocomplete="off"
            /></label
          ><button
            type="button"
            class={s.reveal}
            onclick={() => (showLocker = !showLocker)}
            >{#if showLocker}<EyeOff size={14} /> Hide locker details{:else}<Eye
                size={14}
              /> Show locker details{/if}</button
          >
        {:else}
          <Choice label="Day to copy" bind:value={copyFrom} items={days} />
          <p class={s.notice}>
            {doc.current.classes.filter((c) => c.day === copyFrom).length} classes
            will be repeated. Empty slots will also replace existing classes. After-class
            plans stay as they are.
          </p>
          {#if confirmCopy}<p class={s.error} role="alert">
              Replace the other four days’ classes with this day? This cannot be
              undone.
            </p>{/if}
        {/if}
        {#if error}<p class={s.error} role="alert">{error}</p>{/if}
        <div class={s.actions}>
          {#if !fresh && ["class", "period", "activity"].includes(modal)}<button
              type="button"
              class={s.deleteButton}
              onclick={remove}>{confirmDelete ? "Remove all" : "Delete"}</button
            >{/if}<Dialog.Close class={s.secondary} type="button"
            >Cancel</Dialog.Close
          ><button class={s.primary} type="submit"
            >{modal === "copy"
              ? confirmCopy
                ? "Replace & copy"
                : "Copy across week"
              : "Save changes"}</button
          >
        </div>
      </form></Dialog.Content
    ></Dialog.Portal
  ></Dialog.Root
>
<IconTarget><Icon /></IconTarget><ExportTarget
  ><Export data={doc.current} /></ExportTarget
>
