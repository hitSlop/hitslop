<script lang="ts">
  import { ready } from "@hitslop/runtime";
  import { jsonStore, IconTarget, ExportTarget } from "@hitslop/svelte";
  import { onDestroy } from "svelte";
  import { Checkbox, DropdownMenu, Tabs } from "bits-ui";
  import Check from "@lucide/svelte/icons/check";
  import Plus from "@lucide/svelte/icons/plus";
  import Archive from "@lucide/svelte/icons/archive";
  import Ellipsis from "@lucide/svelte/icons/ellipsis";
  import RotateCcw from "@lucide/svelte/icons/rotate-ccw";
  import checklistSchema from "../schema";
  import type { Checklist } from "../schema";
  import Icon from "./Icon.svelte";
  import Export from "./Export.svelte";
  import Brand from "./Brand.svelte";
  import * as s from "./styles.css";

  const checklist = jsonStore({ schema: checklistSchema, initial: {
    title: "Little things, today",
    tasks: [
      { id: "first-draft", text: "Send the first draft", done: true, archived: false },
      { id: "walk", text: "Take a walk without my phone", done: false, archived: false },
      { id: "weekend", text: "Make a little room for the weekend", done: false, archived: false },
    ],
  } });
  let activeView = $state<"tasks" | "filed">("tasks");
  let draft = $state("");
  let composer = $state<HTMLInputElement>();
  let notice = $state("");
  let undo = $state<null | (() => void)>(null);
  const visible = $derived(checklist.current.tasks.filter(task => !task.archived));
  const filed = $derived(checklist.current.tasks.filter(task => task.archived));
  const finished = $derived(visible.filter(task => task.done).length);
  $effect(() => { if (checklist.isReady) ready(); });
  $effect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => { notice = ""; undo = null; }, 4000);
    return () => window.clearTimeout(timer);
  });
  onDestroy(() => checklist.destroy());

  function addTask() {
    const text = draft.trim();
    if (!text || checklist.isLoading) return;
    checklist.current.tasks.push({ id: crypto.randomUUID(), text, done: false, archived: false });
    draft = "";
    composer?.focus();
  }
  function move(id: string, direction: -1 | 1) {
    const index = visible.findIndex(task => task.id === id);
    const neighbor = visible[index + direction];
    if (!neighbor) return;
    const tasks = checklist.current.tasks;
    const from = tasks.findIndex(task => task.id === id);
    const to = tasks.findIndex(task => task.id === neighbor.id);
    [tasks[from], tasks[to]] = [tasks[to]!, tasks[from]!];
  }
  function remove(id: string) {
    const index = checklist.current.tasks.findIndex(task => task.id === id);
    const task = checklist.current.tasks[index];
    if (!task) return;
    const saved: Checklist["tasks"][number] = { ...task };
    checklist.current.tasks.splice(index, 1);
    notice = "Task removed.";
    undo = () => { checklist.current.tasks.splice(Math.min(index, checklist.current.tasks.length), 0, saved); };
    composer?.focus();
  }
  function fileFinished() {
    const ids = visible.filter(task => task.done).map(task => task.id);
    checklist.current.tasks.forEach(task => { if (ids.includes(task.id)) task.archived = true; });
    notice = `${ids.length} ${ids.length === 1 ? "task" : "tasks"} filed.`;
    undo = () => { checklist.current.tasks.forEach(task => { if (ids.includes(task.id)) task.archived = false; }); };
  }
  function restore(id: string) {
    const task = checklist.current.tasks.find(task => task.id === id);
    if (task) { task.archived = false; task.done = false; }
    notice = "Task moved back to your list.";
    undo = null;
  }
  function sizeToText(node: HTMLTextAreaElement, _value: string) {
    let timer: ReturnType<typeof setTimeout>;
    let width = -1;
    const resize = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        node.style.height = "auto";
        node.style.height = `${node.scrollHeight}px`;
      });
    };
    const observer = new ResizeObserver(entries => {
      const next = entries[0]?.contentRect.width;
      if (next !== undefined && next !== width) { width = next; resize(); }
    });
    observer.observe(node);
    node.addEventListener("input", resize);
    resize();
    return { update: resize, destroy() { clearTimeout(timer); observer.disconnect(); node.removeEventListener("input", resize); } };
  }
</script>

<main class={s.shell} data-slop-selection="none" aria-busy={checklist.isLoading}>
  <Brand />
  <section class={s.paper} aria-label="Your checklist" inert={!checklist.isReady || checklist.isLoading}>
    <div class={s.heading}>
      <p class={s.eyebrow}>A little less on your mind.</p>
      <textarea class={s.title} aria-label="Checklist title" rows="1" use:sizeToText={checklist.current.title} bind:value={checklist.current.title} placeholder="Name your list" data-slop-export="hide"></textarea>
      <div class={s.progress}>
        <span aria-live="polite">{visible.length && finished === visible.length ? "All done. Nicely done." : `${visible.length - finished} left to do`}</span>
        <span>{finished} / {visible.length} done</span>
      </div>
      <div class={s.track} aria-hidden="true"><div style:width={`${visible.length ? finished / visible.length * 100 : 0}%`}></div></div>
    </div>
    <form class={s.composer} data-slop-export="hide" onsubmit={event => { event.preventDefault(); addTask(); }}>
      <input bind:this={composer} bind:value={draft} aria-label="New task" placeholder="Add a little thing…" disabled={checklist.isLoading} />
      <button type="submit" aria-label="Add task" disabled={!draft.trim() || checklist.isLoading}><Plus size={20} /></button>
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
            <li class={s.row} data-done={task.done}>
              <Checkbox.Root checked={task.done} onCheckedChange={checked => task.done = checked} aria-label={`Mark ${task.text || "untitled task"} ${task.done ? "incomplete" : "complete"}`}>
                {#snippet children({ checked })}{#if checked}<Check size={17} strokeWidth={3} />{/if}{/snippet}
              </Checkbox.Root>
              <textarea class={s.taskText} aria-label={`Task ${index + 1}`} rows="1" use:sizeToText={task.text} bind:value={task.text} placeholder="Untitled task" data-slop-export="hide" onkeydown={event => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); composer?.focus(); } }}></textarea>
              <DropdownMenu.Root>
                <DropdownMenu.Trigger class={s.more} aria-label={`Actions for ${task.text || "untitled task"}`} data-slop-export="hide"><Ellipsis size={19} /></DropdownMenu.Trigger>
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
          {#each filed as task (task.id)}<div class={s.filedRow}><span>{task.text || "Untitled task"}</span><button data-slop-export="hide" onclick={() => restore(task.id)} aria-label={`Restore ${task.text || "untitled task"}`}><RotateCcw size={16} /> Restore</button></div>
          {:else}<div class={s.empty}><Archive size={30} /><h2>No filed tasks yet.</h2><p>Finish a task, then file it from your to-do list.</p></div>{/each}
        </div>
      {/if}
    </div>
    <div class={s.paperFoot} data-slop-export="hide"><span>{activeView === "tasks" ? "Enter to add. Check to finish." : "Restore anything you need again."}</span>{#if activeView === "tasks"}<button onclick={fileFinished} disabled={!finished}><Archive size={15} /> File finished{finished ? ` (${finished})` : ""}</button>{/if}</div>
  </section>
  {#if notice}<div class={s.notice} role="status" data-slop-export="hide"><span>{notice}</span>{#if undo}<button onclick={() => { undo?.(); undo = null; notice = "Undone."; }}>Undo</button>{/if}</div>{/if}
  {#if checklist.error}
    <div class={s.error} role="alert">
      <span>{checklist.isReady ? "Changes haven’t been saved." : "Your checklist couldn’t be loaded."} {checklist.error}</span>
      <button data-slop-export="hide" onclick={() => { if (checklist.isReady) void checklist.flush().catch(() => undefined); else void checklist.reload(); }}>Try again</button>
    </div>
  {:else if checklist.isLoading}<p class={s.error} role="status">Loading your checklist…</p>{/if}
</main>
<IconTarget><Icon completed={finished} total={visible.length} /></IconTarget>
<ExportTarget><Export checklist={checklist.current} view={activeView} /></ExportTarget>
