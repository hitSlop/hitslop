<script lang="ts">
  import { Checkbox } from "bits-ui";
  import { query, mutation } from "@hitslop/svelte/collections";
  import { api } from "../_generated/api";
  import type { Doc } from "../_generated/dataModel";
  import * as s from "./styles.css";
  let title = $state("");
  let cursor = $state<string | undefined>();
  const rows = $derived(query(api.todos.find, { index: "by_created", order: "desc", limit: 25, ...(cursor ? { cursor } : {}) }));
  const total = query(api.todos.count, {});
  const { mutate: insert, pending } = mutation(api.todos.insert);
  const { mutate: update } = mutation(api.todos.update);
  async function add() { if (!title.trim()) return; try { await insert({ title: title.trim(), completed: false, createdAt: Date.now() }); title = ""; cursor = undefined; } catch { /* Host owns persistence errors. */ } }
  async function toggle(row: Doc<"todos">, completed: boolean) { try { await update({ id: row._id, changes: { completed } }); } catch { /* Host owns persistence errors. */ } }
</script>
<main class={s.page}>
  <h1 class={s.heading}>Tasks, in order.</h1>
  <p class={s.caption}>{$total ?? 0} {$total === 1 ? "task" : "tasks"} · a little space to get things done</p>
  <form class={s.form} onsubmit={event => { event.preventDefault(); void add(); }}>
    <input class={s.input} aria-label="New task" placeholder="What needs doing?" required maxlength="512" bind:value={title} />
    <button class={s.button} disabled={$pending}>Add task</button>
  </form>
  <table class={s.table}>
    <thead><tr><th class={s.cell} scope="col">Done</th><th class={s.cell} scope="col">Task</th></tr></thead>
    <tbody>{#each $rows?.items ?? [] as row (row._id)}
      <tr class={s.row}><td class={s.cell}><Checkbox.Root class={s.check} checked={row.completed} onCheckedChange={checked => toggle(row, checked)} aria-label={`Complete ${row.title}`}>{row.completed ? "✓" : ""}</Checkbox.Root></td><td class={`${s.cell} ${row.completed ? s.done : ""}`}>{row.title}</td></tr>
    {:else}<tr><td colspan="2" class={s.cell}>{$rows ? "Start with one small task." : "Loading tasks…"}</td></tr>{/each}</tbody>
  </table>
  <div class={s.footer}>
    {#if cursor}<button class={s.button} onclick={() => cursor = undefined}>Newest tasks</button>{/if}
    {#if $rows?.nextCursor}<button class={s.button} onclick={() => cursor = $rows?.nextCursor ?? undefined}>Older tasks</button>{/if}
  </div>
</main>
