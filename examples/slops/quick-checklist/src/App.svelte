<script lang="ts">
  import { createDocument, Slop, type MutationResult } from "@hitslop/svelte";
  import type { Attachment } from "svelte/attachments";
  import { prefersReducedMotion } from "svelte/motion";
  import { flip } from "svelte/animate";
  import { Checkbox, DropdownMenu, Tabs } from "bits-ui";
  import Check from "@lucide/svelte/icons/check";
  import Plus from "@lucide/svelte/icons/plus";
  import Archive from "@lucide/svelte/icons/archive";
  import Ellipsis from "@lucide/svelte/icons/ellipsis";
  import RotateCcw from "@lucide/svelte/icons/rotate-ccw";
  import checklistSchema from "../schema";
  import initial from "../initial";
  import Icon from "./Icon.svelte";
  import Export from "./Export.svelte";
  import Brand from "./Brand.svelte";
  import * as s from "./styles.css";

  const checklist = createDocument({ schema: checklistSchema, initial });
  const { fields } = checklist;
  let activeView = $state<"tasks" | "filed">("tasks");
  let draft = $state("");
  let adding = $state(false);
  let composer = $state<HTMLInputElement>();
  type Notice = { text: string; result?: Extract<MutationResult, { ok: true }> };
  let notice = $state.raw<Notice | null>(null);
  let undoing = $state(false);
  let tasksTab = $state<HTMLButtonElement | null>(null);
  let filedTab = $state<HTMLButtonElement | null>(null);
  const show = (text: string, result?: Notice["result"]) => { notice = { text, ...(result ? { result } : {}) }; };
  async function undoNotice() {
    const current = notice;
    if (!current?.result?.undo || !current.result.canUndo || undoing) return;
    undoing = true;
    try {
      if ((await current.result.undo()).ok && notice === current) show("Undone.");
    } finally { undoing = false; }
  }
  const visible = $derived(checklist.data.tasks.filter(task => !task.archived));
  const filed = $derived(checklist.data.tasks.filter(task => task.archived));
  const finished = $derived(visible.filter(task => task.done).length);
  const ratio = $derived(visible.length ? finished / visible.length * 100 : 0);
  $effect(() => {
    const current = notice;
    if (!current || current.result?.undo) return;
    const timer = setTimeout(() => { if (notice === current) notice = null; }, 4000);
    return () => clearTimeout(timer);
  });
  const flipMs = $derived(prefersReducedMotion.current ? 0 : 240);

  async function addTask() {
    const text = draft.trim();
    if (!text || adding || !checklist.canWrite) return;
    adding = true;
    try {
      const result = await checklist.insert(fields.tasks, { text, done: false, archived: false });
      if (result.ok) { if (draft.trim() === text) draft = ""; composer?.focus(); }
    } finally { adding = false; }
  }
  function move(id: string, direction: -1 | 1) {
    const index = visible.findIndex(task => task.id === id);
    const neighbor = visible[index + direction];
    if (neighbor) void checklist.move(fields.tasks, id, direction < 0 ? { before: neighbor.id } : { after: neighbor.id });
  }
  async function remove(id: string) {
    const result = await checklist.remove(fields.tasks, id);
    if (!result.ok) return;
    show("Task removed.", result);
    composer?.focus();
  }
  async function fileFinished() {
    const ids = visible.filter(task => task.done).map(task => task.id);
    const result = await checklist.transaction(tx => { for (const id of ids) tx.set(fields.tasks.item(id).archived, true); });
    if (!result.ok) return;
    show(`${ids.length} ${ids.length === 1 ? "task" : "tasks"} filed.`, result);
    tasksTab?.focus();
  }
  async function restore(id: string) {
    const result = await checklist.patch(fields.tasks.item(id), { archived: false, done: false });
    if (!result.ok) return;
    show("Task moved back to your list.");
    filedTab?.focus();
  }
  function sizeToText(value: () => string): Attachment<HTMLTextAreaElement> {
    return node => {
      let timer: ReturnType<typeof setTimeout>;
      let width = -1;
      const resize = () => {
        clearTimeout(timer);
        // Run after the text attachment paints its draft; works in offscreen WebKit too.
        timer = setTimeout(() => {
          if (!node.getClientRects().length) return;
          node.style.height = "auto";
          node.style.height = `${node.scrollHeight + node.offsetHeight - node.clientHeight}px`;
        }, 0);
      };
      $effect(() => { value(); resize(); });
      const observer = new ResizeObserver(entries => {
        const next = entries[0]?.contentRect.width;
        if (next !== undefined && next !== width) { width = next; resize(); }
      });
      observer.observe(node);
      node.addEventListener("input", resize);
      return () => { clearTimeout(timer); observer.disconnect(); node.removeEventListener("input", resize); };
    };
  }
</script>

<Slop document={checklist}>
<main class={s.shell} data-slop-selection="none">
  <Brand />
  <section class={s.paper} aria-label="Your checklist">
    <div class={s.heading}>
      <p class={s.eyebrow}>A little less on your mind.</p>
      <textarea class={s.title} aria-label="Checklist title" rows="1" {@attach sizeToText(() => checklist.data.title)} {@attach checklist.text(fields.title)} readonly={!checklist.canWrite} placeholder="Name your list" data-slop-export="hide"></textarea>
      <div class={s.progress}>
        <span aria-live="polite">{visible.length && finished === visible.length ? "All done. Nicely done." : `${visible.length - finished} left to do`}</span>
        <span>{finished} / {visible.length} done</span>
      </div>
      <div class={s.track} aria-hidden="true"><div style:transform={`scaleX(${ratio / 100})`}></div></div>
    </div>
    <form class={s.composer} data-slop-export="hide" onsubmit={event => { event.preventDefault(); void addTask(); }}>
      <input bind:this={composer} bind:value={draft} aria-label="New task" placeholder="Add a little thing…" disabled={!checklist.canWrite} />
      <button type="submit" aria-label="Add task" disabled={adding || !draft.trim() || !checklist.canWrite}><Plus size={20} /></button>
    </form>
    <Tabs.Root class={s.views} value={activeView} onValueChange={value => { if (value === "tasks" || value === "filed") activeView = value; }}>
      <Tabs.List class={s.tabs} aria-label="Checklist views" data-slop-export="hide">
        <Tabs.Trigger bind:ref={tasksTab} value="tasks" class={s.tab}>To do <span>{visible.length}</span></Tabs.Trigger>
        <Tabs.Trigger bind:ref={filedTab} value="filed" class={s.tab}><Archive size={14} /> Filed <span>{filed.length}</span></Tabs.Trigger>
      </Tabs.List>
    <div class={[s.scroller, activeView === "filed" && s.filedView]}>
      <Tabs.Content value="tasks">
        <ol class={s.list}>
          {#each visible as task, index (task.id)}
            {const field = $derived(fields.tasks.item(task.id))}
            <li class={s.row} data-done={task.done} animate:flip={{ duration: flipMs }}>
              <Checkbox.Root checked={task.done} onCheckedChange={checked => { void checklist.set(field.done, checked === true); }} disabled={!checklist.canWrite || checklist.isPending(field.done)} aria-label={`Mark ${task.text || "untitled task"} ${task.done ? "incomplete" : "complete"}`}>
                {#snippet children({ checked })}{#if checked}<Check size={17} strokeWidth={3} />{/if}{/snippet}
              </Checkbox.Root>
              <textarea class={s.taskText} aria-label={`Task ${index + 1}`} rows="1" {@attach sizeToText(() => task.text)} {@attach checklist.text(field.text)} readonly={!checklist.canWrite} placeholder="Untitled task" data-slop-export="hide" onkeydown={event => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); composer?.focus(); } }}></textarea>
              <DropdownMenu.Root>
                <DropdownMenu.Trigger disabled={!checklist.canWrite} class={s.more} aria-label={`Actions for ${task.text || "untitled task"}`} data-slop-export="hide"><Ellipsis size={19} /></DropdownMenu.Trigger>
                <DropdownMenu.Portal><DropdownMenu.Content class={s.menu} sideOffset={5} align="end" data-slop-export="hide">
                  <DropdownMenu.Item disabled={index === 0} onSelect={() => move(task.id, -1)}>Move up</DropdownMenu.Item>
                  <DropdownMenu.Item disabled={index === visible.length - 1} onSelect={() => move(task.id, 1)}>Move down</DropdownMenu.Item>
                  <DropdownMenu.Separator /><DropdownMenu.Item onSelect={() => { void remove(task.id); }}>Remove task</DropdownMenu.Item>
                </DropdownMenu.Content></DropdownMenu.Portal>
              </DropdownMenu.Root>
            </li>
          {/each}
        </ol>
        {#if !visible.length}<div class={s.empty}><Check size={30} /><h2>A little breathing room.</h2><p>Catch your next small task above.</p></div>{/if}
      </Tabs.Content>
      <Tabs.Content value="filed">
        <ul class={s.filedList}>
          {#each filed as task (task.id)}<li class={s.filedRow}><span>{task.text || "Untitled task"}</span><button data-slop-export="hide" disabled={!checklist.canWrite} onclick={() => { void restore(task.id); }} aria-label={`Restore ${task.text || "untitled task"}`}><RotateCcw size={16} /> Restore</button></li>
          {:else}<li class={s.empty}><Archive size={30} /><h2>No filed tasks yet.</h2><p>Finish a task, then file it from your to-do list.</p></li>{/each}
        </ul>
      </Tabs.Content>
    </div>
    </Tabs.Root>
    <div class={s.paperFoot} data-slop-export="hide"><span>{activeView === "tasks" ? "Enter to add. Check to finish." : "Restore anything you need again."}</span>{#if activeView === "tasks"}<button onclick={fileFinished} disabled={!finished || !checklist.canWrite}><Archive size={15} /> File finished{finished ? ` (${finished})` : ""}</button>{/if}</div>
  </section>
  <div role="status" data-slop-export="hide">
    {#if notice}<div class={s.notice}>
      <span>{notice.result?.undo && notice.result.revision !== checklist.revision ? "Undo unavailable after another change." : notice.text}</span>
      {#if notice.result?.undo}<button disabled={!notice.result.canUndo || undoing} onclick={() => { void undoNotice(); }}>Undo</button>{/if}
      <button aria-label="Dismiss notice" onclick={() => { notice = null; }}>Dismiss</button>
    </div>{/if}
  </div>

</main>
{#snippet icon()}<Icon completed={finished} total={visible.length} />{/snippet}
{#snippet exportView()}<Export checklist={checklist.data} view={activeView} />{/snippet}
</Slop>
