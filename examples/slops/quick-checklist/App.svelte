<script lang="ts">
  import { Slop, useDocument, bindText } from "@hitslop/document/svelte";
  import { onDestroy, untrack } from "svelte";
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

  const doc = useDocument(schema);
  let activeView = $state<"tasks" | "filed">("tasks");
  let draft = $state("");
  let composer = $state<HTMLInputElement>();
  let notice = $state("");
  const visible = $derived(doc.current.tasks.filter(task => !task.archived));
  const filed = $derived(doc.current.tasks.filter(task => task.archived));
  const finished = $derived(visible.filter(task => task.done).length);
  const ratio = $derived(visible.length ? finished / visible.length * 100 : 0);
  const fill = new Tween(untrack(() => ratio), { duration: 280, easing: cubicOut });
  let initialized = false;
  $effect(() => {
    void fill.set(ratio, { duration: !initialized || prefersReducedMotion.current ? 0 : 280, delay: 0 });
    initialized = true;
  });
  onDestroy(() => { void fill.set(fill.target, {duration:0,delay:0}); });
  $effect(() => { if (notice) { const timer = setTimeout(() => notice = "", 4000); return () => clearTimeout(timer); } });
  const flipMs = $derived(prefersReducedMotion.current ? 0 : 240);
  const exported = $derived(activeView === "filed" ? filed : visible);
  const exportFinished = $derived(exported.filter(task => task.done).length);
  const marks = $derived(visible.length ? Math.round(3 * finished / visible.length) : 0);

  function addTask() {
    const text = draft.trim(); if (!text) return;
    doc.fields.tasks.insert({text, done:false, archived:false});
    draft = ""; composer?.focus();
  }
  function move(id: string, direction: -1 | 1) {
    const index = visible.findIndex(task => task.$id === id);
    const neighbor = visible[index + direction]; if (!neighbor) return;
    doc.fields.tasks.move(id, direction === -1 ? {before:neighbor.$id} : {after:neighbor.$id});
  }
  function remove(id: string) { doc.fields.tasks.remove(id); notice = "Task removed."; composer?.focus(); }
  function fileFinished() {
    const done = visible.filter(task => task.done);
    doc.change(tx => { for (const task of done) tx.at(task).archived.set(true); }, {message: "File finished tasks"});
    notice = `${done.length} ${done.length === 1 ? "task" : "tasks"} filed.`;
  }
  function restore(task: (typeof filed)[number]) {
    doc.change(tx => { const row = tx.at(task); row.archived.set(false); row.done.set(false); });
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
<header class="checklist-header">
  <span class="checklist-brand"><Check size={15} strokeWidth={3} /> Quick Checklist</span>
  <span class="checklist-edition" aria-hidden="true">ONE THING AT A TIME</span>
</header>

{/snippet}

<Slop>
<main
  class="checklist-shell"
  data-slop-selection="none"
>
  {@render brand()}
  <section
    class="checklist-paper"
    aria-label="Your checklist"
  >
    <div class="checklist-heading">
      <p class="checklist-eyebrow">A little less on your mind.</p>
      <textarea
        class="checklist-title"
        aria-label="Checklist title"
        rows="1"
        use:sizeToText={doc.current.title}
        use:bindText={doc.fields.title}
        placeholder="Name your list"
      ></textarea>
      <div class="checklist-progress">
        <span aria-live="polite"
          >{visible.length && finished === visible.length
            ? "All done. Nicely done."
            : `${visible.length - finished} left to do`}</span
        >
        <span>{finished} / {visible.length} done</span>
      </div>
      <div class="checklist-track" aria-hidden="true">
        <div style:transform={`scaleX(${fill.current / 100})`}></div>
      </div>
    </div>
    <form
      class="checklist-composer"
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
        class="checklist-tabs"
        aria-label="Checklist views"
      >
        <Tabs.Trigger value="tasks" class="checklist-tab"
          >To do <span>{visible.length}</span></Tabs.Trigger
        >
        <Tabs.Trigger value="filed" class="checklist-tab"
          ><Archive size={14} /> Filed <span>{filed.length}</span></Tabs.Trigger
        >
      </Tabs.List>
    </Tabs.Root>
    <div class={`${"checklist-scroller"} ${activeView === "filed" ? "checklist-filed-view" : ""}`}>
      {#if activeView === "tasks"}
        <ol class="checklist-list">
          {#each visible as task, index (task.$id)}
            <li
              class="checklist-row"
              data-done={task.done}
              animate:flip={{ duration: flipMs }}
            >
              <Checkbox.Root
                checked={task.done}
                onCheckedChange={(checked) => doc.at(task).done.set(checked)}
                aria-label={`Mark ${task.text || "untitled task"} ${task.done ? "incomplete" : "complete"}`}
              >
                {#snippet children({ checked })}{#if checked}<Check
                      size={17}
                      strokeWidth={3}
                    />{/if}{/snippet}
              </Checkbox.Root>
              <textarea
                class="checklist-task-text"
                aria-label={`Task ${index + 1}`}
                rows="1"
                use:sizeToText={task.text}
                use:bindText={doc.at(task).text}
                placeholder="Untitled task"
                onkeydown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    composer?.focus();
                  }
                }}
              ></textarea>
              <DropdownMenu.Root>
                <DropdownMenu.Trigger
                  class="checklist-more"
                  aria-label={`Actions for ${task.text || "untitled task"}`}
                  ><Ellipsis size={19} /></DropdownMenu.Trigger
                >
                <DropdownMenu.Portal
                  ><DropdownMenu.Content
                    class="checklist-menu"
                    sideOffset={5}
                    align="end"
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
        {#if !visible.length}<div class="checklist-empty">
            <Check size={30} />
            <h2>A little breathing room.</h2>
            <p>Catch your next small task above.</p>
          </div>{/if}
      {:else}
        <div class="checklist-filed-list">
          {#each filed as task (task.$id)}<div class="checklist-filed-row">
              <span>{task.text || "Untitled task"}</span><button
                onclick={() => restore(task)}
                aria-label={`Restore ${task.text || "untitled task"}`}
                ><RotateCcw size={16} /> Restore</button
              >
            </div>
          {:else}<div class="checklist-empty">
              <Archive size={30} />
              <h2>No filed tasks yet.</h2>
              <p>Finish a task, then file it from your to-do list.</p>
            </div>{/each}
        </div>
      {/if}
    </div>
    <div class="checklist-paper-foot">
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
  {#if notice}<div class="checklist-notice" role="status">{notice}</div>{/if}
</main>

{#snippet exportView()}
<article class="checklist-shell">
  {@render brand()}
  <section class="checklist-paper" aria-label="Exported checklist">
    <div class="checklist-heading">
      <p class="checklist-eyebrow">{activeView === "filed" ? "Filed tasks" : "A little less on your mind."}</p>
      <h1 class="checklist-title" style:white-space="pre-wrap" style:overflow-wrap="anywhere">{doc.current.title || "Untitled list"}</h1>
      <div class="checklist-progress"><span>{activeView === "filed" ? `${exported.length} filed` : `${exported.length - exportFinished} left to do`}</span><span>{exportFinished} / {exported.length} done</span></div>
      <div class="checklist-track"><div style:width={`${exported.length ? exportFinished / exported.length * 100 : 0}%`}></div></div>
    </div>
    <ol class="checklist-list">
      {#each exported as task (task.$id)}
        <li class="checklist-row" data-done={task.done}>
          <span data-checkbox-root data-state={task.done ? "checked" : "unchecked"} aria-label={task.done ? "Complete" : "Incomplete"}>{#if task.done}<Check size={17} strokeWidth={3} />{/if}</span>
          <span class="checklist-task-text" style:white-space="pre-wrap">{task.text || "Untitled task"}</span>
        </li>
      {/each}
    </ol>
    {#if !exported.length}<div class="checklist-empty"><Check size={30} /><h2>{activeView === "filed" ? "No filed tasks yet." : "A little breathing room."}</h2></div>{/if}
  </section>
</article>

{/snippet}
{#snippet icon()}
<div class="checklist-icon-tile" aria-hidden="true"><div class="checklist-icon-paper">
    {#each [0, 1, 2] as index}
      <div data-complete={index < marks}><span>{#if index < marks}<Check size={32} strokeWidth={3} />{/if}</span><i></i></div>
    {/each}
  </div></div>

{/snippet}
</Slop>
