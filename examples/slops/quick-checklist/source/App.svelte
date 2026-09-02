<script lang="ts">
  import { capture } from "@hitslop/runtime";
  import { jsonStore } from "@hitslop/svelte";
  import Archive from "@lucide/svelte/icons/archive";
  import ArrowDown from "@lucide/svelte/icons/arrow-down";
  import ArrowUp from "@lucide/svelte/icons/arrow-up";
  import Check from "@lucide/svelte/icons/check";
  import Plus from "@lucide/svelte/icons/plus";
  import Trash2 from "@lucide/svelte/icons/trash-2";
  import Icon from "./Icon.svelte";

  type Task = { id: string; text: string; done: boolean; archived: boolean };
  type Checklist = { title: string; tasks: Task[] };
  const checklist = jsonStore<Checklist>({ title: "Today", tasks: [] });
  let draft = $state("");
  let composer = $state<HTMLInputElement>();

  const visibleTasks = $derived(checklist.current.tasks.filter((task) => !task.archived));
  const completedCount = $derived(visibleTasks.filter((task) => task.done).length);
  const archiveCount = $derived(checklist.current.tasks.filter((task) => task.archived).length);

  function addTask(): void {
    const text = draft.trim();
    if (!text) return;
    checklist.current.tasks.unshift({ id: crypto.randomUUID(), text, done: false, archived: false });
    draft = "";
    requestAnimationFrame(() => composer?.focus());
  }
  function move(id: string, direction: -1 | 1): void {
    const from = checklist.current.tasks.findIndex((task) => task.id === id);
    const to = from + direction;
    if (from < 0 || to < 0 || to >= checklist.current.tasks.length) return;
    const [task] = checklist.current.tasks.splice(from, 1);
    checklist.current.tasks.splice(to, 0, task);
  }
  function remove(id: string): void {
    checklist.current.tasks = checklist.current.tasks.filter((task) => task.id !== id);
  }
  function archiveFinished(): void {
    checklist.current.tasks.forEach((task) => { if (task.done) task.archived = true; });
  }
  function clearArchive(): void {
    checklist.current.tasks = checklist.current.tasks.filter((task) => !task.archived);
  }
</script>

<main class="checklist-shell" data-slop-selection="none">
  <header class="checklist-header">
    <div class="brand"><span>Quick list</span><i aria-hidden="true"></i></div>
    <label><span>List name</span><input aria-label="Checklist title" bind:value={checklist.current.title} /></label>
    <p>{visibleTasks.length - completedCount} open · {completedCount} complete</p>
  </header>

  <section class="task-well" aria-labelledby="tasks-label">
    <div class="well-head"><h1 id="tasks-label">{checklist.current.title || "Untitled list"}</h1><span>{visibleTasks.length} item{visibleTasks.length === 1 ? "" : "s"}</span></div>
    <form class="composer" data-slop-export="hide" onsubmit={(event) => { event.preventDefault(); addTask(); }}>
      <input bind:this={composer} bind:value={draft} aria-label="New task" placeholder="What needs doing?" />
      <button type="submit" aria-label="Add task"><Plus /></button>
    </form>

    {#if visibleTasks.length}
      <ol class="task-list">
        {#each visibleTasks as task, index (task.id)}
          <li class:done={task.done}>
            <button class="complete" onclick={() => task.done = !task.done} aria-label={task.done ? `Mark ${task.text} incomplete` : `Mark ${task.text} complete`}><Check /></button>
            <input aria-label="Task {index + 1}" bind:value={task.text} onkeydown={(event) => { if (event.key === "Enter") { event.preventDefault(); composer?.focus(); } }} />
            <div class="task-actions" data-slop-export="hide">
              <button onclick={() => move(task.id, -1)} aria-label={`Move ${task.text} up`} disabled={index === 0}><ArrowUp /></button>
              <button onclick={() => move(task.id, 1)} aria-label={`Move ${task.text} down`} disabled={index === visibleTasks.length - 1}><ArrowDown /></button>
              <button class="remove" onclick={() => remove(task.id)} aria-label={`Delete ${task.text}`}><Trash2 /></button>
            </div>
          </li>
        {/each}
      </ol>
    {:else}
      <div class="empty"><span>✓</span><strong>The tray is clear.</strong><p>Use the field above to catch the next small thing.</p></div>
    {/if}
  </section>

  <footer class="checklist-footer">
    <div data-slop-export="hide"><button onclick={archiveFinished} disabled={completedCount === 0}><Archive /> File finished</button>{#if archiveCount}<button class="clear" onclick={clearArchive}>Clear {archiveCount} filed</button>{/if}</div>
    <span>{archiveCount ? `${archiveCount} filed item${archiveCount === 1 ? "" : "s"}` : "Finish a task, then file it."}</span>
  </footer>
  {#if checklist.error}<p class="save-error">Changes could not be saved. {checklist.error}</p>{/if}
</main>

{#if capture.isRenderer()}<Icon />{/if}
