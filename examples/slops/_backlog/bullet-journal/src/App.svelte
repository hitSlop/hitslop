<script lang="ts">
  import { ready } from "@hitslop/runtime";
  import { jsonStore, IconTarget, ExportTarget } from "@hitslop/svelte";
  import { onDestroy } from "svelte";
  import { prefersReducedMotion } from "svelte/motion";
  import { flip } from "svelte/animate";
  import { Tabs, Toggle, Select, Button, Tooltip } from "bits-ui";
  import Plus from "@lucide/svelte/icons/plus";
  import Trash2 from "@lucide/svelte/icons/trash-2";
  import Star from "@lucide/svelte/icons/star";
  import Check from "@lucide/svelte/icons/check";
  import ChevronDown from "@lucide/svelte/icons/chevron-down";
  import List from "@lucide/svelte/icons/list";
  import Calendar from "@lucide/svelte/icons/calendar";
  import bulletJournalSchema from "../schema";
  import type { BulletJournal } from "../schema";
  import { SIGNIFIERS, signifierItems, isSignifier, symbolFor, labelFor, nextSignifier, type Signifier } from "./signifiers";
  import Icon from "./Icon.svelte";
  import Export from "./Export.svelte";
  import * as s from "./styles.css";

  type Spread = "daily" | "monthly";
  type Entry = BulletJournal["entries"][number];

  const doc = jsonStore({ schema: bulletJournalSchema, initial: {
    date: "Wednesday, September 9, 2026",
    monthTitle: "September 2026",
    dailyPage: "42",
    monthlyPage: "40",
    entries: [
      { id: "e1", type: "task", star: true, text: "Ship the Eisenhower & Ivy Lee productivity dockets" },
      { id: "e2", type: "complete", star: false, text: "Morning review of server latency telemetry" },
      { id: "e3", type: "event", star: false, text: "14:00 Studio design sync with architectural team" },
      { id: "e4", type: "note", star: false, text: "A single physical balance beam clarifies weighted decisions" },
      { id: "e5", type: "migrated", star: false, text: "Update developer documentation on packaging invariants" },
      { id: "e6", type: "task", star: false, text: "Order heavier grain fountain pen ink refills" },
    ],
    monthlyLog: [
      { id: "m1", day: 1, weekday: "Tu", text: "Labor Day / Studio Planning" },
      { id: "m2", day: 2, weekday: "We", text: "Core templates sprint kickoff" },
      { id: "m3", day: 3, weekday: "Th", text: "Release candidate verification" },
      { id: "m4", day: 4, weekday: "Fr", text: "Team demo & retrospective" },
      { id: "m5", day: 12, weekday: "Sa", text: "Mountain trail run" },
      { id: "m6", day: 15, weekday: "Tu", text: "Quarterly budget audit" },
    ],
  } });

  let spread = $state<Spread>("daily");
  let draft = $state("");
  let draftType = $state<Signifier>("task");
  let draftStar = $state(false);
  let composer = $state<HTMLInputElement>();
  $effect(() => { if (doc.isReady) ready(); });
  onDestroy(() => doc.destroy());

  const openCount = $derived(doc.current.entries.filter(item => item.type === "task" || item.type === "scheduled").length);
  const flipMs = $derived(prefersReducedMotion.current ? 0 : 220);

  function isSpread(value: string): value is Spread {
    return value === "daily" || value === "monthly";
  }
  function addEntry() {
    const text = draft.trim();
    if (!text || doc.isLoading) return;
    doc.current.entries.push({ id: crypto.randomUUID(), type: draftType, star: draftStar, text });
    draft = "";
    draftStar = false;
    composer?.focus();
  }
  function cycleSignifier(item: Entry) {
    item.type = nextSignifier(item.type);
  }
  function removeEntry(id: string) {
    doc.current.entries = doc.current.entries.filter(item => item.id !== id);
  }
  function addMonthDay() {
    const last = doc.current.monthlyLog.at(-1);
    const day = Math.min(31, (last?.day ?? 0) + 1);
    doc.current.monthlyLog.push({ id: crypto.randomUUID(), day, weekday: "", text: "" });
  }
  function removeMonthDay(id: string) {
    doc.current.monthlyLog = doc.current.monthlyLog.filter(item => item.id !== id);
  }
</script>

<Tooltip.Provider>
<main class={s.page} data-slop-selection="none" aria-busy={doc.isLoading} aria-label="Bullet journal">
  <span class={s.ribbon} aria-hidden="true"></span>

  <header class={s.header}>
    <Tabs.Root value={spread} onValueChange={value => { if (isSpread(value)) spread = value; }}>
      <Tabs.List class={s.tabs} data-slop-export="hide" aria-label="Journal spread">
        <Tabs.Trigger value="daily" class={s.tab}><List size={12} strokeWidth={2.2} /> Daily Rapid Log</Tabs.Trigger>
        <Tabs.Trigger value="monthly" class={s.tab}><Calendar size={12} strokeWidth={2.2} /> Monthly Index</Tabs.Trigger>
      </Tabs.List>
    </Tabs.Root>
    <div class={s.legend} data-slop-export="hide">
      {#each SIGNIFIERS as item}
        <span class={s.legendItem} title={item.label}><strong class={s.legendSym}>{item.symbol}</strong>{item.label}</span>
      {/each}
      <span class={s.legendItem} title="Priority"><strong class={s.legendSym}>*</strong>Priority</span>
    </div>
  </header>

  <article class={s.spread} inert={!doc.isReady || doc.isLoading} aria-label={spread === "daily" ? "Daily rapid log" : "Monthly index"}>
    {#if spread === "daily"}
      <div class={s.titleRow}>
        <input class={s.title} aria-label="Log date" bind:value={doc.current.date} placeholder="Today" />
        <label class={s.pageNumWrap}><span class={s.srOnly}>Daily page number</span><span aria-hidden="true">pg.</span> <input class={s.pageNum} bind:value={doc.current.dailyPage} /></label>
      </div>

      <ul class={s.list}>
        {#each doc.current.entries as item (item.id)}
          <li class={s.row} data-complete={item.type === "complete"} animate:flip={{ duration: flipMs }}>
            <Toggle.Root
              type="button"
              pressed={item.star}
              onPressedChange={pressed => { item.star = pressed; }}
              class={s.starBtn}
              aria-label={item.star ? "Remove priority" : "Mark as priority"}
            >
              {#if item.star}
                <Star size={11} fill="currentColor" />
              {:else}
                <span aria-hidden="true">·</span>
              {/if}
            </Toggle.Root>
            <Tooltip.Root>
              <Tooltip.Trigger
                class={s.signifier}
                data-type={item.type}
                type="button"
                aria-label="{labelFor(item.type)} signifier. Cycle to the next mark."
                onclick={() => cycleSignifier(item)}
              >{symbolFor(item.type)}</Tooltip.Trigger>
              <Tooltip.Portal>
                <Tooltip.Content class={s.tooltip} sideOffset={6}>Click to cycle • × › ‹ ○ —</Tooltip.Content>
              </Tooltip.Portal>
            </Tooltip.Root>
            <input class={s.entryText} aria-label="Rapid log entry" bind:value={item.text} placeholder="Task, event, or note" />
            <Tooltip.Root>
              <Tooltip.Trigger class={s.remove} data-slop-export="hide" type="button" aria-label="Delete {item.text || 'entry'}" onclick={() => removeEntry(item.id)}>
                <Trash2 size={12} />
              </Tooltip.Trigger>
              <Tooltip.Portal>
                <Tooltip.Content class={s.tooltip} sideOffset={6}>Remove this line</Tooltip.Content>
              </Tooltip.Portal>
            </Tooltip.Root>
          </li>
        {:else}
          <li class={s.empty}>
            <h2>A blank page.</h2>
            <p>Rapid log a task, event, or note. Click the bullet to cycle its signifier.</p>
          </li>
        {/each}
      </ul>

      <form class={s.composer} data-slop-export="hide" onsubmit={event => { event.preventDefault(); addEntry(); }}>
        <Toggle.Root
          type="button"
          pressed={draftStar}
          onPressedChange={pressed => { draftStar = pressed; }}
          class={s.starToggle}
          aria-label="Mark new entry as priority"
        >
          <Star size={12} fill={draftStar ? "currentColor" : "none"} />
        </Toggle.Root>
        <Select.Root type="single" value={draftType} items={signifierItems} onValueChange={value => { if (isSignifier(value)) draftType = value; }}>
          <Select.Trigger class={s.selectTrigger} type="button" aria-label="Signifier for new entry">
            <Select.Value placeholder="Signifier" />
            <ChevronDown size={12} strokeWidth={2.2} />
          </Select.Trigger>
          <Select.Portal>
            <Select.Content class={s.selectContent} sideOffset={6}>
              <Select.Viewport>
                {#each signifierItems as item (item.value)}
                  <Select.Item value={item.value} label={item.label}>
                    {#snippet children({ selected })}
                      {item.label}{#if selected}<Check size={12} strokeWidth={2.4} />{/if}
                    {/snippet}
                  </Select.Item>
                {/each}
              </Select.Viewport>
            </Select.Content>
          </Select.Portal>
        </Select.Root>
        <input bind:this={composer} class={s.addInput} aria-label="New rapid log entry" placeholder="Rapid log an item…" bind:value={draft} disabled={doc.isLoading} />
        <Button.Root class={s.add} type="submit" aria-label="Add entry" disabled={!draft.trim() || doc.isLoading}><Plus size={14} /></Button.Root>
      </form>
    {:else}
      <div class={s.titleRow}>
        <input class={s.title} aria-label="Month title" bind:value={doc.current.monthTitle} placeholder="Month" />
        <label class={s.pageNumWrap}><span class={s.srOnly}>Monthly page number</span><span aria-hidden="true">pg.</span> <input class={s.pageNum} bind:value={doc.current.monthlyPage} /></label>
      </div>

      <ul class={s.list}>
        {#each doc.current.monthlyLog as item (item.id)}
          <li class={s.monthRow} animate:flip={{ duration: flipMs }}>
            <input class={s.monthDay} type="number" min="1" max="31" aria-label="Day of month" bind:value={item.day} />
            <input class={s.monthWeekday} aria-label="Weekday" maxlength="3" placeholder="—" bind:value={item.weekday} />
            <input class={s.monthText} aria-label="Monthly event for day {item.day}" placeholder="Key event or milestone…" bind:value={item.text} />
            <button class={s.remove} data-slop-export="hide" type="button" aria-label="Delete day {item.day}" onclick={() => removeMonthDay(item.id)}><Trash2 size={12} /></button>
          </li>
        {:else}
          <li class={s.empty}>
            <h2>No days indexed.</h2>
            <p>Add the dates that matter this month.</p>
          </li>
        {/each}
      </ul>
      <div class={s.monthComposer} data-slop-export="hide">
        <Button.Root class={s.addDay} type="button" onclick={addMonthDay}>+ Add day</Button.Root>
      </div>
    {/if}
  </article>

  <footer class={s.foot}>
    {#if spread === "daily"}
      <span>{doc.current.entries.length} bullets · {openCount} open</span>
      <span>Rapid log</span>
    {:else}
      <span>{doc.current.monthlyLog.length} days indexed</span>
      <span>Monthly log</span>
    {/if}
  </footer>

  {#if doc.error}
    <div class={s.error} role="alert">
      <span>{doc.isReady ? "Changes haven’t been saved." : "Your journal couldn’t be loaded."} {doc.error}</span>
      <button data-slop-export="hide" onclick={() => { if (doc.isReady) void doc.flush().catch(() => undefined); else void doc.reload(); }}>Try again</button>
    </div>
  {:else if doc.isLoading}<p class={s.error} role="status">Opening the notebook…</p>{/if}
</main>

<IconTarget><Icon /></IconTarget>
<ExportTarget><Export data={doc.current} {spread} /></ExportTarget>
</Tooltip.Provider>
