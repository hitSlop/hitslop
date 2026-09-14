<script lang="ts">
  import { ready } from "@hitslop/runtime";
  import { jsonStore, IconTarget, ExportTarget } from "@hitslop/svelte";
  import { onDestroy } from "svelte";
  import { prefersReducedMotion } from "svelte/motion";
  import { flip } from "svelte/animate";
  import { Tabs, Checkbox, Dialog, Select } from "bits-ui";
  import Plus from "@lucide/svelte/icons/plus";
  import Check from "@lucide/svelte/icons/check";
  import ArrowUpRight from "@lucide/svelte/icons/arrow-up-right";
  import assignmentSchema, { type Assignment } from "../schema";
  import {
    addDaysISO,
    todayISO,
    relativeDue,
    parseISO,
    groupAssignments,
    msUntilNextDay,
  } from "./due";
  import DuePicker from "./DuePicker.svelte";
  import Icon from "./Icon.svelte";
  import Export from "./Export.svelte";
  import * as s from "./styles.css";
  const doc = jsonStore({
    schema: assignmentSchema,
    initial: {
      studentName: "Alex Rivera",
      term: "Fall Semester 2026",
      courses: [
        { id: "c1", code: "BIO", name: "AP Biology", colorHex: "#3b7a57" },
        { id: "c2", code: "CALC", name: "Pre-Calculus", colorHex: "#4f46e5" },
        { id: "c3", code: "LIT", name: "Honors Lit", colorHex: "#4a5d6e" },
        { id: "c4", code: "HIST", name: "World History", colorHex: "#d97706" },
        { id: "c5", code: "SPAN", name: "Spanish III", colorHex: "#c2410c" },
      ],
      assignments: [
        {
          id: "a1",
          courseCode: "BIO",
          title: "Cellular Respiration Lab Writeup",
          dueDate: todayISO(),
          category: "Lab Report",
          points: 50,
          completed: false,
          notes: "Include graph for trial 3 enzyme rate",
        },
        {
          id: "a2",
          courseCode: "CALC",
          title: "Problem Set 2.4: Trigonometric Identities #1–24",
          dueDate: todayISO(),
          category: "Problem Set",
          points: 20,
          completed: false,
          notes: "Show all unit circle substitutions",
        },
        {
          id: "a3",
          courseCode: "LIT",
          title: "Read The Great Gatsby Chapters 1–3",
          dueDate: addDaysISO(2),
          category: "Reading",
          points: 15,
          completed: false,
          notes: "Annotate the green light motif",
        },
        {
          id: "a4",
          courseCode: "HIST",
          title: "DBQ Outline: Industrial Revolution",
          dueDate: addDaysISO(4),
          category: "Essay",
          points: 40,
          completed: false,
          notes: "Draft a thesis before Friday",
        },
        {
          id: "a5",
          courseCode: "SPAN",
          title: "Subjunctive workbook p.42–45",
          dueDate: addDaysISO(1),
          category: "Homework",
          points: 10,
          completed: true,
          notes: "",
        },
        {
          id: "a6",
          courseCode: "BIO",
          title: "Unit 1 Quiz Prep: Macromolecules",
          dueDate: addDaysISO(5),
          category: "Quiz Prep",
          points: 30,
          completed: false,
          notes: "Review Leitner box 2",
        },
      ],
    },
  });
  let filter = $state("todo");
  let day = $state(todayISO());
  $effect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const refresh = () => {
      clearTimeout(timer);
      day = todayISO();
      timer = setTimeout(refresh, msUntilNextDay(new Date()));
    };
    const visible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    refresh();
    document.addEventListener("visibilitychange", visible);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", visible);
    };
  });
  $effect(() => {
    if (doc.isReady) ready();
  });
  onDestroy(() => doc.destroy());
  const active = $derived(doc.current.assignments.filter((i) => !i.completed));
  const completed = $derived(
    doc.current.assignments.filter((i) => i.completed),
  );
  const dueToday = $derived(
    active.filter((i) => relativeDue(i.dueDate, day).urgency === "today")
      .length,
  );
  const overdue = $derived(
    active.filter((i) => relativeDue(i.dueDate, day).urgency === "overdue")
      .length,
  );
  const readout = $derived(
    overdue
      ? `${overdue} overdue`
      : dueToday
        ? `${dueToday} due today`
        : active.length
          ? `${active.length} to do`
          : "All caught up",
  );
  const stacks = $derived(
    groupAssignments(filter === "done" ? completed : active, day),
  );
  let open = $state(false),
    fresh = $state(false),
    error = $state("");
  let draft = $state<Assignment>({
    id: "",
    courseCode: "",
    title: "",
    dueDate: "",
    category: "",
    points: 0,
    completed: false,
    notes: "",
  });
  let origin: HTMLElement | null = null;
  function edit(item?: Assignment, event?: Event) {
    origin =
      (event?.currentTarget as HTMLElement) ||
      (document.activeElement as HTMLElement);
    fresh = !item;
    draft = item
      ? { ...item }
      : {
          id: crypto.randomUUID(),
          courseCode: doc.current.courses[0]?.code || "",
          title: "",
          dueDate: day,
          category: "Homework",
          points: 0,
          completed: false,
          notes: "",
        };
    error = "";
    open = true;
  }
  function save(event: SubmitEvent) {
    event.preventDefault();
    error = "";
    if (!draft.title.trim()) {
      error = "Give this assignment a title.";
      return;
    }
    if (!Number.isFinite(draft.points) || draft.points < 0) {
      error = "Points must be zero or greater.";
      return;
    }
    const old = doc.current.assignments.find((i) => i.id === draft.id);
    if (
      draft.dueDate &&
      !parseISO(draft.dueDate) &&
      (!old || draft.dueDate !== old.dueDate)
    ) {
      error = "Choose a valid due date or leave it undated.";
      return;
    }
    if (fresh)
      doc.current.assignments.push({ ...draft, title: draft.title.trim() });
    else if (old) Object.assign(old, draft, { title: draft.title.trim() });
    open = false;
  }
  function remove() {
    doc.current.assignments = doc.current.assignments.filter(
      (i) => i.id !== draft.id,
    );
    open = false;
  }
  function restore(event: Event) {
    event.preventDefault();
    (origin?.isConnected
      ? origin
      : document.querySelector<HTMLElement>("[data-add-assignment]")
    )?.focus({ preventScroll: true });
  }
  const courseChoices = $derived(
    doc.current.courses.some((c) => c.code === draft.courseCode) ||
      !draft.courseCode
      ? doc.current.courses
      : [
          ...doc.current.courses,
          {
            id: "legacy",
            code: draft.courseCode,
            name: "Saved course",
            colorHex: "",
          },
        ],
  );
</script>

<main
  class={s.pad}
  aria-label="Assignment tracker"
  aria-busy={doc.isLoading}
  data-slop-selection="none"
>
  <div class={s.app} inert={!doc.isReady || doc.isLoading}>
    <header class={s.header}>
      <div class={s.identity}>
        <span class={s.eyebrow}>ASSIGNMENTS / STUDY PAD</span><input
          class={s.student}
          aria-label="Student name"
          bind:value={doc.current.studentName}
          placeholder="Your study pad"
        /><input
          class={s.term}
          aria-label="Term"
          bind:value={doc.current.term}
          placeholder="Your term"
        />
      </div>
      <div class={s.summary}>
        <span class={s.readout} data-urgent={overdue > 0 || dueToday > 0}
          >{readout}</span
        ><span class={s.summaryDetail}
          >{overdue && dueToday
            ? `${dueToday} also due today`
            : `${completed.length} completed`}</span
        >
      </div>
    </header>
    <div class={s.toolbar}>
      <Tabs.Root bind:value={filter}
        ><Tabs.List class={s.tabs} aria-label="Assignment lists"
          ><Tabs.Trigger class={s.tab} value="todo"
            >To do <span>{active.length}</span></Tabs.Trigger
          ><Tabs.Trigger class={s.tab} value="done"
            >Done <span>{completed.length}</span></Tabs.Trigger
          ></Tabs.List
        ></Tabs.Root
      ><button
        class={s.add}
        data-add-assignment
        onclick={(e) => edit(undefined, e)}
        ><Plus size={15} /> Add assignment</button
      >
    </div>
    <div class={s.stacks}>
      {#each stacks as stack (stack.id)}<section
          class={s.stack}
          aria-label={stack.label}
        >
          <div class={s.stackHead}>
            <h2 class={s.stackLabel} data-urgency={stack.id}>{stack.label}</h2>
            <span class={s.stackCount}>{stack.items.length}</span>
          </div>
          <ul class={s.list}>
            {#each stack.items as item (item.id)}{@const due = relativeDue(
                item.dueDate,
                day,
              )}
              <li
                class={s.row}
                data-done={item.completed}
                animate:flip={{
                  duration: prefersReducedMotion.current ? 0 : 180,
                }}
              >
                <Checkbox.Root
                  class={s.checkbox}
                  checked={item.completed}
                  onCheckedChange={(checked) =>
                    (item.completed = checked === true)}
                  aria-label="Mark {item.title || 'assignment'} {item.completed
                    ? 'incomplete'
                    : 'complete'}"
                  >{#snippet children({ checked })}{#if checked}<Check
                        size={14}
                        strokeWidth={3}
                      />{/if}{/snippet}</Checkbox.Root
                >
                <button
                  class={s.itemBody}
                  onclick={(e) => edit(item, e)}
                  aria-label="Edit {item.title || 'assignment'}"
                  ><strong class={s.itemTitle}
                    >{item.title || "Untitled assignment"}</strong
                  ><span class={s.itemMeta}
                    ><span
                      class={s.courseChip}
                      title={doc.current.courses.find(
                        (c) => c.code === item.courseCode,
                      )?.name}>{item.courseCode || "No course"}</span
                    >{#if item.category}<span class={s.category}
                        >{item.category}</span
                      >{/if}{#if item.points}<span>{item.points} pts</span
                      >{/if}</span
                  >{#if item.notes}<span class={s.notePreview}
                      >{item.notes}</span
                    >{/if}</button
                >
                <div class={s.rowEnd}>
                  <DuePicker
                    value={item.dueDate}
                    label={due.label}
                    urgency={item.completed ? "done" : due.urgency}
                    onSelect={(iso) => {
                      item.dueDate = iso;
                    }}
                  /><button
                    class={s.editArrow}
                    onclick={(e) => edit(item, e)}
                    aria-label="Assignment details for {item.title}"
                    ><ArrowUpRight size={15} /></button
                  >
                </div>
              </li>{/each}
          </ul>
        </section>
      {:else}<div class={s.empty}>
          <span class={s.emptyCheck}><Check size={30} /></span>
          <h2>
            {filter === "done"
              ? "Good work goes here."
              : doc.current.assignments.length
                ? "A little breathing room."
                : "Make room for good work."}
          </h2>
          <p>
            {filter === "done"
              ? "Check off an assignment when it’s finished."
              : doc.current.assignments.length
                ? "You’re caught up. Enjoy it."
                : "Add your first assignment and give it a due date."}
          </p>
          {#if filter !== "done"}<button
              class={s.secondary}
              onclick={(e) => edit(undefined, e)}>Add assignment</button
            >{/if}
        </div>{/each}
    </div>
    <footer class={s.footer}>
      <span>One thing at a time.</span><span
        >{completed.length} / {doc.current.assignments.length} complete</span
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
</main>
<Dialog.Root bind:open
  ><Dialog.Portal
    ><Dialog.Overlay class={s.overlay} /><Dialog.Content
      class={s.dialog}
      onCloseAutoFocus={restore}
      ><Dialog.Title class={s.dialogTitle}
        >{fresh ? "Add an assignment" : "Assignment details"}</Dialog.Title
      ><Dialog.Description class={s.description}
        >What needs doing, and when?</Dialog.Description
      >
      <form class={s.form} onsubmit={save}>
        <label class={s.formLabel}
          >Assignment<textarea
            class={s.titleField}
            bind:value={draft.title}
            placeholder="Lab, paper, or reading…"
            required
            rows="2"></textarea></label
        >
        <div class={s.formRow}>
          <div class={s.formLabel}>
            <span>Course</span><Select.Root
              type="single"
              bind:value={draft.courseCode}
              ><Select.Trigger class={s.input} aria-label="Course"
                >{draft.courseCode || "No course"} ▾</Select.Trigger
              ><Select.Portal
                ><Select.Content class={s.selectContent} sideOffset={5}
                  ><Select.Viewport
                    ><Select.Item
                      class={s.selectItem}
                      value=""
                      label="No course">No course</Select.Item
                    >{#each courseChoices as c}<Select.Item
                        class={s.selectItem}
                        value={c.code}
                        label={c.name}>{c.code} · {c.name}</Select.Item
                      >{/each}</Select.Viewport
                  ></Select.Content
                ></Select.Portal
              ></Select.Root
            >
          </div>
          <label class={s.formLabel}
            >Category<input
              class={s.input}
              bind:value={draft.category}
              placeholder="Essay, lab, reading…"
            /></label
          >
        </div>
        <div class={s.formRow}>
          <div class={s.formLabel}>
            <span>Due date</span><DuePicker
              value={draft.dueDate}
              label={relativeDue(draft.dueDate, day).label}
              urgency={relativeDue(draft.dueDate, day).urgency}
              onSelect={(iso) => (draft.dueDate = iso)}
            />{#if draft.dueDate}<button
                class={s.clearDate}
                type="button"
                onclick={() => (draft.dueDate = "")}>Leave undated</button
              >{/if}
          </div>
          <label class={s.formLabel}
            >Points<input
              class={s.input}
              type="number"
              min="0"
              step="any"
              bind:value={draft.points}
            /></label
          >
        </div>
        <label class={s.formLabel}
          >Notes<textarea
            class={s.notesField}
            bind:value={draft.notes}
            placeholder="Instructions, links, or a place to start…"
            rows="4"></textarea></label
        >
        {#if error}<p class={s.error} role="alert">{error}</p>{/if}
        <div class={s.actions}>
          {#if !fresh}<button
              class={s.deleteButton}
              type="button"
              onclick={remove}>Delete</button
            >{/if}<Dialog.Close type="button" class={s.secondary}
            >Cancel</Dialog.Close
          ><button type="submit" class={s.primary}>Save assignment</button>
        </div>
      </form></Dialog.Content
    ></Dialog.Portal
  ></Dialog.Root
>
<IconTarget><Icon /></IconTarget><ExportTarget
  ><Export data={doc.current} reference={day} /></ExportTarget
>
