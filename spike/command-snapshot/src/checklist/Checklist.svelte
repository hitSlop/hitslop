<script lang="ts">
  import { onDestroy, untrack } from "svelte";
  import { flip } from "svelte/animate";
  import { prefersReducedMotion } from "svelte/motion";
  import { Checkbox, DropdownMenu, Tabs } from "bits-ui";
  import Check from "@lucide/svelte/icons/check";
  import Plus from "@lucide/svelte/icons/plus";
  import Archive from "@lucide/svelte/icons/archive";
  import Ellipsis from "@lucide/svelte/icons/ellipsis";
  import RotateCcw from "@lucide/svelte/icons/rotate-ccw";
  import { fields } from "../checklist-schema.ts";
  import type { Client } from "../demo.svelte.ts";
  import type { Result } from "../protocol.ts";
  import Brand from "./Brand.svelte";
  import * as s from "./styles.css";

  let { client }: { client: Client } = $props();
  const checklist = untrack(() => client.store);
  let activeView = $state<"tasks" | "filed">("tasks");
  let draft = $state("");
  let adding = $state(false);
  let composer = $state<HTMLInputElement>();
  let notice = $state("");
  let undo = $state<null | (() => Promise<Result>)>(null);
  let resume = $state<null | (() => void)>(null);
  const visible = $derived(checklist.data.tasks.filter(task => !task.archived));
  const filed = $derived(checklist.data.tasks.filter(task => task.archived));
  const finished = $derived(visible.filter(task => task.done).length);
  const ratio = $derived(visible.length ? finished / visible.length * 100 : 0);
  const flipMs = $derived(prefersReducedMotion.current ? 0 : 180);
  let noticeTimer: ReturnType<typeof setTimeout>;
  const announce = (text: string) => { clearTimeout(noticeTimer); notice = text; noticeTimer = setTimeout(() => { notice = ""; undo = null; }, 8000); };
  onDestroy(() => clearTimeout(noticeTimer));
  function complete(result: Result, action: () => void) {
    if (result.ok) action();
    else if (result.error.code === "unknown_outcome") resume = action;
  }
  async function resolve() {
    const result = await checklist.retryUnknown();
    if (result.ok) { const action = resume; resume = null; action?.(); }
  }
  async function addTask() {
    const text = draft.trim(), submittedDraft = draft;
    if (!text || adding || !checklist.canWrite) return;
    adding = true;
    const result = await checklist.insert(fields.tasks, { id: crypto.randomUUID(), text, done: false, archived: false });
    complete(result, () => { if (draft === submittedDraft) draft = ""; composer?.focus(); });
    adding = false;
  }
  async function move(id: string, direction: -1 | 1) {
    const index = visible.findIndex(task => task.id === id), neighbor = visible[index + direction];
    if (neighbor) await checklist.move(fields.tasks, id, direction < 0 ? { before: neighbor.id } : { after: neighbor.id });
  }
  async function remove(id: string) {
    const index = checklist.data.tasks.findIndex(row => row.id === id), task = checklist.data.tasks[index];
    if (!task) return;
    const saved = { ...task }, next = checklist.data.tasks[index + 1]?.id;
    const result = await checklist.remove(fields.tasks, id);
    complete(result, () => {
      announce("Task removed.");
      undo = async () => {
        const anchor = next && checklist.data.tasks.some(row => row.id === next) ? { before: next } : undefined;
        let result = await checklist.insert(fields.tasks, saved, anchor);
        if (!result.ok && result.error.code === "missing_anchor") {
          checklist.clearError(); result = await checklist.insert(fields.tasks, saved);
        }
        return result;
      };
    });
  }
  async function fileFinished() {
    const ids = visible.filter(task => task.done).map(task => task.id);
    const result = await checklist.change(tx => { for (const id of ids) tx.set(fields.tasks.item(id).archived, true); });
    complete(result, () => {
      announce(`${ids.length} ${ids.length === 1 ? "task" : "tasks"} filed.`);
      undo = () => checklist.change(tx => { for (const id of ids) tx.set(fields.tasks.item(id).archived, false); });
    });
  }
  async function restore(id: string) {
    const result = await checklist.patch(fields.tasks.item(id), { archived: false, done: false });
    complete(result, () => { announce("Task moved back to your list."); undo = null; });
  }
  async function runUndo() {
    if (!undo) return;
    const result = await undo();
    complete(result, () => { undo = null; announce("Undone."); });
  }
  function sizeToText(node: HTMLTextAreaElement, _value: string) {
    const resize = () => { node.style.height = "auto"; node.style.height = `${node.scrollHeight}px`; };
    const observer = new ResizeObserver(resize); observer.observe(node);
    node.addEventListener("input", resize); queueMicrotask(resize);
    return { update() { queueMicrotask(resize); }, destroy() { observer.disconnect(); node.removeEventListener("input", resize); } };
  }
</script>
<main class={s.shell} data-slop-selection="none" aria-busy={checklist.isLoading}>
  <Brand />
  <section class={s.paper} aria-label="Your checklist" inert={checklist.isLoading}>
    <div class={s.heading}>
      <p class={s.eyebrow}>A little less on your mind.</p>
      <textarea class={s.title} aria-label="Checklist title" rows="1" use:sizeToText={checklist.data.title} use:checklist.text={fields.title} readonly={!checklist.canWrite} placeholder="Name your list" data-slop-export="hide"></textarea>
      <div class={s.progress}>
        <span aria-live="polite">{visible.length && finished === visible.length ? "All done. Nicely done." : `${visible.length - finished} left to do`}</span>
        <span>{finished} / {visible.length} done</span>
      </div>
      <div class={s.track} aria-hidden="true"><div style:transform={`scaleX(${ratio / 100})`}></div></div>
    </div>
    <form class={s.composer} data-slop-export="hide" onsubmit={event => { event.preventDefault(); addTask(); }}>
      <input bind:this={composer} bind:value={draft} aria-label="New task" placeholder="Add a little thing…" disabled={!checklist.canWrite} />
      <button type="submit" aria-label="Add task" disabled={adding || !draft.trim() || !checklist.canWrite || checklist.pending > 0}><Plus size={20} /></button>
    </form>
    <Tabs.Root value={activeView} onValueChange={value => { if (value === "tasks" || value === "filed") activeView = value; }}>
      <Tabs.List class={s.tabs} aria-label="Checklist views" data-slop-export="hide">
        <Tabs.Trigger value="tasks" class={s.tab}>To do <span>{visible.length}</span></Tabs.Trigger>
        <Tabs.Trigger value="filed" class={s.tab}><Archive size={14} /> Filed <span>{filed.length}</span></Tabs.Trigger>
      </Tabs.List>
    </Tabs.Root>
    <div class={`${s.scroller} ${activeView === "filed" ? s.filedView : ""}`}>
      {#if activeView === "tasks"}
        <ol class={s.list}>
          {#each visible as task, index (task.id)}
            <li class={s.row} data-task-id={task.id} data-done={task.done} animate:flip={{ duration: flipMs }}>
              <Checkbox.Root checked={task.done} disabled={!checklist.canWrite || checklist.pending > 0} onCheckedChange={checked => { void checklist.set(fields.tasks.item(task).done, checked === true); }} aria-label={`Mark ${task.text || "untitled task"} ${task.done ? "incomplete" : "complete"}`}>
                {#snippet children({ checked })}{#if checked}<Check size={17} strokeWidth={3} />{/if}{/snippet}
              </Checkbox.Root>
              <textarea class={s.taskText} aria-label={`Task ${index + 1}`} rows="1" use:sizeToText={task.text} use:checklist.text={fields.tasks.item(task).text} readonly={!checklist.canWrite} placeholder="Untitled task" data-slop-export="hide" onkeydown={event => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); composer?.focus(); } }}></textarea>
              <DropdownMenu.Root>
                <DropdownMenu.Trigger disabled={!checklist.canWrite || checklist.pending > 0} class={s.more} aria-label={`Actions for ${task.text || "untitled task"}`} data-slop-export="hide"><Ellipsis size={19} /></DropdownMenu.Trigger>
                <DropdownMenu.Portal><DropdownMenu.Content class={s.menu} sideOffset={5} align="end" data-slop-export="hide">
                  <DropdownMenu.Item disabled={index === 0} onSelect={() => move(task.id, -1)}>Move up</DropdownMenu.Item>
                  <DropdownMenu.Item disabled={index === visible.length - 1} onSelect={() => move(task.id, 1)}>Move down</DropdownMenu.Item>
                  <DropdownMenu.Separator /><DropdownMenu.Item onSelect={() => remove(task.id)}>Remove task</DropdownMenu.Item>
                </DropdownMenu.Content></DropdownMenu.Portal>
              </DropdownMenu.Root>
            </li>
          {/each}
        </ol>
        {#if !visible.length}<div class={s.empty}><Check size={30} /><h2>A little breathing room.</h2><p>Catch your next small task above.</p></div>{/if}
      {:else}
        <div class={s.filedList}>
          {#each filed as task (task.id)}<div class={s.filedRow}><span>{task.text || "Untitled task"}</span><button disabled={!checklist.canWrite || checklist.pending > 0} data-slop-export="hide" onclick={() => restore(task.id)} aria-label={`Restore ${task.text || "untitled task"}`}><RotateCcw size={16} /> Restore</button></div>
          {:else}<div class={s.empty}><Archive size={30} /><h2>No filed tasks yet.</h2><p>Finish a task, then file it from your to-do list.</p></div>{/each}
        </div>
      {/if}
    </div>
    <div class={s.paperFoot} data-slop-export="hide"><span>{activeView === "tasks" ? "Enter to add. Check to finish." : "Restore anything you need again."}</span>{#if activeView === "tasks"}<button onclick={fileFinished} disabled={!finished || !checklist.canWrite || checklist.pending > 0}><Archive size={15} /> File finished{finished ? ` (${finished})` : ""}</button>{/if}</div>
  </section>
  {#if notice}<div class={s.notice} role="status" data-slop-export="hide"><span>{notice}</span>{#if undo}<button disabled={!checklist.canWrite || checklist.pending > 0} onclick={runUndo}>Undo</button>{/if}</div>{/if}
  {#if checklist.error}
    <div class={s.error} role="alert">
      <span>{checklist.error.message}</span>
      {#if checklist.hasUnknownOutcome}<button onclick={resolve} disabled={!checklist.connected || checklist.pending > 0}>Resolve request</button>
      {:else}<button onclick={() => checklist.clearError()}>Dismiss error</button>{/if}
    </div>
  {/if}
</main>
