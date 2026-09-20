<script lang="ts">
  import { tick } from "svelte";
  import { Checkbox } from "bits-ui";
  import { Slop, useDocument, bindText } from "@hitslop/document/svelte";
  import { checklist } from "./schema";
  import * as styles from "./styles.css";
  const doc = useDocument(checklist);
  const { title, tasks } = doc.fields;
  const taskInputs = new Map<string, HTMLInputElement>();
  function taskInput(node: HTMLInputElement, id: string) {
    taskInputs.set(id, node);
    return { destroy() { taskInputs.delete(id); } };
  }
  let newTask = $state("");
  const complete = $derived(doc.current.tasks.filter(task => task.done).length);
  async function add() {
    if (!newTask.trim()) return;
    const { id } = tasks.insert({ text: newTask.trim(), done: false });
    newTask = "";
    await tick();
    taskInputs.get(id)?.focus();
  }
</script>
<Slop document={doc}>
<main class={styles.paper}>
  <div class={styles.eyebrow}>Little checklist</div>
  <input class={styles.title} aria-label="List title" use:bindText={title} />
  <p class={styles.summary}>{complete} of {doc.current.tasks.length} done. One thing at a time.</p>
  {#if !doc.current.tasks.length}<p class={styles.summary}>A little breathing room. Add your first task below.</p>{/if}
  <ul class={styles.list}>
    {#each doc.current.tasks as task, index (task.$id)}
      <li class={styles.row} data-task-id={task.$id}>
        <Checkbox.Root class={styles.check} aria-label={`Complete ${task.text}`} checked={task.done}
          onCheckedChange={(value) => tasks.item(task.$id).done.set(value)}>
          {#if task.done}<span aria-hidden="true">✓</span>{/if}
        </Checkbox.Root>
        <input class={styles.text} data-done={task.done} aria-label="Task text" use:bindText={tasks.item(task.$id).text} use:taskInput={task.$id} />
        <div class={styles.actions} data-slop-export="hide">
          <button class={styles.small} aria-label="Move task up" disabled={index === 0} onclick={() => tasks.move(task.$id, { before: doc.current.tasks[index - 1]!.$id })}>↑</button>
          <button class={styles.small} aria-label="Move task down" disabled={index === doc.current.tasks.length - 1} onclick={() => tasks.move(task.$id, { after: doc.current.tasks[index + 1]!.$id })}>↓</button>
          <button class={styles.small} aria-label="Delete task" onclick={() => tasks.remove(task.$id)}>×</button>
        </div>
      </li>
    {/each}
  </ul>
  <form class={styles.add} onsubmit={(event) => { event.preventDefault(); return add(); }} data-slop-export="hide">
    <input class={styles.entry} aria-label="New task" placeholder="Something to do…" bind:value={newTask} />
    <button class={styles.button} disabled={!newTask.trim()}>Add</button>
  </form>
  <footer class={styles.footer}>
    <span>Your list, at your pace.</span>
  </footer>
</main>
</Slop>
