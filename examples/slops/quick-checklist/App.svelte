<script lang="ts">
  import { Slop, useDocument, bindText } from "@hitslop/document/svelte";
  import { capture } from "@hitslop/document/capture";
  import { onDestroy, onMount, tick, untrack } from "svelte";
  import { Tween, prefersReducedMotion } from "svelte/motion";
  import { cubicOut } from "svelte/easing";
  import { flip } from "svelte/animate";
  import { Checkbox, DropdownMenu, Tabs } from "bits-ui";
  import Check from "@lucide/svelte/icons/check";
  import Plus from "@lucide/svelte/icons/plus";
  import Archive from "@lucide/svelte/icons/archive";
  import Ellipsis from "@lucide/svelte/icons/ellipsis";
  import RotateCcw from "@lucide/svelte/icons/rotate-ccw";
  import schema from "./schema";
  import * as s from "./styles.css";

  const document = useDocument(schema);
  let activeView = $state<"tasks" | "filed">("tasks");
  let draft = $state("");
  let composer = $state<HTMLInputElement>();
  let notice = $state("");
  const visible = $derived(document.current.tasks.filter(task => !task.archived));
  const filed = $derived(document.current.tasks.filter(task => task.archived));
  const finished = $derived(visible.filter(task => task.done).length);
  const ratio = $derived(visible.length ? finished / visible.length * 100 : 0);
  const fill = new Tween(untrack(() => ratio), { duration: 280, easing: cubicOut });
  let initialized = false;
  $effect(() => {
    void fill.set(ratio, { duration: !initialized || prefersReducedMotion.current ? 0 : 280, delay: 0 });
    initialized = true;
  });
  onMount(() => capture.onPrepare(async () => { await fill.set(ratio, {duration:0,delay:0}); await tick(); }));
  onDestroy(() => { void fill.set(fill.target, {duration:0,delay:0}); });
  $effect(() => { if (notice) { const timer = setTimeout(() => notice = "", 4000); return () => clearTimeout(timer); } });
  const flipMs = $derived(prefersReducedMotion.current ? 0 : 240);
  const exported = $derived(activeView === "filed" ? filed : visible);
  const exportFinished = $derived(exported.filter(task => task.done).length);
  const marks = $derived(visible.length ? Math.round(3 * finished / visible.length) : 0);

  function addTask() {
    const text = draft.trim(); if (!text) return;
    document.fields.tasks.insert({text, done:false, archived:false});
    draft = ""; composer?.focus();
  }
  function move(id: string, direction: -1 | 1) {
    const index = visible.findIndex(task => task.$id === id);
    const neighbor = visible[index + direction]; if (!neighbor) return;
    document.fields.tasks.move(id, direction === -1 ? {before:neighbor.$id} : {after:neighbor.$id});
  }
  function remove(id: string) { document.fields.tasks.remove(id); notice = "Task removed."; composer?.focus(); }
  function fileFinished() {
    const ids = visible.filter(task => task.done).map(task => task.$id);
    document.transaction(tx => { for (const id of ids) tx.fields.tasks.item(id).archived.set(true); });
    notice = `${ids.length} ${ids.length === 1 ? "task" : "tasks"} filed.`;
  }
  function restore(id: string) {
    document.transaction(tx => { const task = tx.fields.tasks.item(id); task.archived.set(false); task.done.set(false); });
    notice = "Task moved back to your list.";
  }
  function sizeToText(node: HTMLTextAreaElement, _value: string) {
    let timer: ReturnType<typeof setTimeout>; let width = -1;
    const resize = () => { clearTimeout(timer); timer = setTimeout(() => { node.style.height = "auto"; node.style.height = `${node.scrollHeight}px`; }); };
    const observer = new ResizeObserver(entries => { const next = entries[0]?.contentRect.width; if (next !== undefined && next !== width) {width = next; resize();} });
    observer.observe(node); node.addEventListener("input", resize); resize();
    return {update:resize, destroy() {clearTimeout(timer);observer.disconnect();node.removeEventListener("input",resize);} };
  }
</script>

{#snippet brand()}
<header class={s.header}>
  <span class={s.brand}><Check size={15} strokeWidth={3} /> Quick Checklist</span>
  <span class={s.edition} aria-hidden="true">ONE THING AT A TIME</span>
</header>

{/snippet}

<Slop {document}>
<main
  class={s.shell}
  data-slop-selection="none"
>
  {@render brand()}
  <section
    class={s.paper}
    aria-label="Your checklist"
  >
    <div class={s.heading}>
      <p class={s.eyebrow}>A little less on your mind.</p>
      <textarea
        class={s.title}
        aria-label="Checklist title"
        rows="1"
        use:sizeToText={document.current.title}
        use:bindText={document.fields.title}
        placeholder="Name your list"
        data-slop-export="hide"
      ></textarea>
      <div class={s.progress}>
        <span aria-live="polite"
          >{visible.length && finished === visible.length
            ? "All done. Nicely done."
            : `${visible.length - finished} left to do`}</span
        >
        <span>{finished} / {visible.length} done</span>
      </div>
      <div class={s.track} aria-hidden="true">
        <div style:transform={`scaleX(${fill.current / 100})`}></div>
      </div>
    </div>
    <form
      class={s.composer}
      data-slop-export="hide"
      onsubmit={(event) => {
        event.preventDefault();
        addTask();
      }}
    >
      <input
        bind:this={composer}
        bind:value={draft}
        aria-label="New task"
        placeholder="Add a little thing…"
      />
      <button
        type="submit"
        aria-label="Add task"
        disabled={!draft.trim()}
        ><Plus size={20} /></button
      >
    </form>
    <Tabs.Root
      value={activeView}
      onValueChange={(value) => {
        if (value === "tasks" || value === "filed") activeView = value;
      }}
    >
      <Tabs.List
        class={s.tabs}
        aria-label="Checklist views"
        data-slop-export="hide"
      >
        <Tabs.Trigger value="tasks" class={s.tab}
          >To do <span>{visible.length}</span></Tabs.Trigger
        >
        <Tabs.Trigger value="filed" class={s.tab}
          ><Archive size={14} /> Filed <span>{filed.length}</span></Tabs.Trigger
        >
      </Tabs.List>
    </Tabs.Root>
    <div class={`${s.scroller} ${activeView === "filed" ? s.filedView : ""}`}>
      {#if activeView === "tasks"}
        <ol class={s.list}>
          {#each visible as task, index (task.$id)}
            <li
              class={s.row}
              data-done={task.done}
              animate:flip={{ duration: flipMs }}
            >
              <Checkbox.Root
                checked={task.done}
                onCheckedChange={(checked) => document.fields.tasks.item(task.$id).done.set(checked)}
                aria-label={`Mark ${task.text || "untitled task"} ${task.done ? "incomplete" : "complete"}`}
              >
                {#snippet children({ checked })}{#if checked}<Check
                      size={17}
                      strokeWidth={3}
                    />{/if}{/snippet}
              </Checkbox.Root>
              <textarea
                class={s.taskText}
                aria-label={`Task ${index + 1}`}
                rows="1"
                use:sizeToText={task.text}
                use:bindText={document.fields.tasks.item(task.$id).text}
                placeholder="Untitled task"
                data-slop-export="hide"
                onkeydown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    composer?.focus();
                  }
                }}
              ></textarea>
              <DropdownMenu.Root>
                <DropdownMenu.Trigger
                  class={s.more}
                  aria-label={`Actions for ${task.text || "untitled task"}`}
                  data-slop-export="hide"
                  ><Ellipsis size={19} /></DropdownMenu.Trigger
                >
                <DropdownMenu.Portal
                  ><DropdownMenu.Content
                    class={s.menu}
                    sideOffset={5}
                    align="end"
                    data-slop-export="hide"
                  >
                    <DropdownMenu.Item
                      disabled={index === 0}
                      onSelect={() => move(task.$id, -1)}
                      >Move up</DropdownMenu.Item
                    >
                    <DropdownMenu.Item
                      disabled={index === visible.length - 1}
                      onSelect={() => move(task.$id, 1)}
                      >Move down</DropdownMenu.Item
                    >
                    <DropdownMenu.Separator /><DropdownMenu.Item
                      onSelect={() => remove(task.$id)}
                      >Remove task</DropdownMenu.Item
                    >
                  </DropdownMenu.Content></DropdownMenu.Portal
                >
              </DropdownMenu.Root>
            </li>
          {/each}
        </ol>
        {#if !visible.length}<div class={s.empty}>
            <Check size={30} />
            <h2>A little breathing room.</h2>
            <p>Catch your next small task above.</p>
          </div>{/if}
      {:else}
        <div class={s.filedList}>
          {#each filed as task (task.$id)}<div class={s.filedRow}>
              <span>{task.text || "Untitled task"}</span><button
                data-slop-export="hide"
                onclick={() => restore(task.$id)}
                aria-label={`Restore ${task.text || "untitled task"}`}
                ><RotateCcw size={16} /> Restore</button
              >
            </div>
          {:else}<div class={s.empty}>
              <Archive size={30} />
              <h2>No filed tasks yet.</h2>
              <p>Finish a task, then file it from your to-do list.</p>
            </div>{/each}
        </div>
      {/if}
    </div>
    <div class={s.paperFoot} data-slop-export="hide">
      <span
        >{activeView === "tasks"
          ? "Enter to add. Check to finish."
          : "Restore anything you need again."}</span
      >{#if activeView === "tasks"}<button
          onclick={fileFinished}
          disabled={!finished}
          ><Archive size={15} /> File finished{finished
            ? ` (${finished})`
            : ""}</button
        >{/if}
    </div>
  </section>
  {#if notice}<div class={s.notice} role="status" data-slop-export="hide">{notice}</div>{/if}
</main>

{#snippet exportView()}
<article class={s.shell}>
  {@render brand()}
  <section class={s.paper} aria-label="Exported checklist">
    <div class={s.heading}>
      <p class={s.eyebrow}>{activeView === "filed" ? "Filed tasks" : "A little less on your mind."}</p>
      <h1 class={s.title} style:white-space="pre-wrap" style:overflow-wrap="anywhere">{document.current.title || "Untitled list"}</h1>
      <div class={s.progress}><span>{activeView === "filed" ? `${exported.length} filed` : `${exported.length - exportFinished} left to do`}</span><span>{exportFinished} / {exported.length} done</span></div>
      <div class={s.track}><div style:width={`${exported.length ? exportFinished / exported.length * 100 : 0}%`}></div></div>
    </div>
    <ol class={s.list}>
      {#each exported as task (task.$id)}
        <li class={s.row} data-done={task.done}>
          <span data-checkbox-root data-state={task.done ? "checked" : "unchecked"} aria-label={task.done ? "Complete" : "Incomplete"}>{#if task.done}<Check size={17} strokeWidth={3} />{/if}</span>
          <span class={s.taskText} style:white-space="pre-wrap">{task.text || "Untitled task"}</span>
        </li>
      {/each}
    </ol>
    {#if !exported.length}<div class={s.empty}><Check size={30} /><h2>{activeView === "filed" ? "No filed tasks yet." : "A little breathing room."}</h2></div>{/if}
  </section>
</article>

{/snippet}
{#snippet icon()}
<div style="width:512px;height:512px;display:grid;place-items:center" aria-hidden="true">
  <div class={s.iconTile}><div class={s.iconPaper}>
    {#each [0, 1, 2] as index}
      <div data-complete={index < marks}><span>{#if index < marks}<Check size={32} strokeWidth={3} />{/if}</span><i></i></div>
    {/each}
  </div></div>
</div>

{/snippet}
</Slop>
