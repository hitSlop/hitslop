<script lang="ts">
  import { sql, sqliteQuery } from "@slop/svelte";

  type Todo = {
    id: number;
    title: string;
    done: number | boolean;
    position: number;
  };

  const notes = sqliteQuery<Todo>(
    "main",
    sql`SELECT id, title, done, position FROM todos ORDER BY position, id`
  );

  let draft = $state("");
  let editingID = $state<number | null>(null);
  let editingTitle = $state("");

  const completedCount = $derived(notes.current.filter((todo) => isDone(todo)).length);

  function focusOnMount(node: HTMLInputElement): { destroy: () => void } {
    const frame = requestAnimationFrame(() => node.focus());
    return { destroy: () => cancelAnimationFrame(frame) };
  }

  function isDone(todo: Todo): boolean {
    return todo.done === true || todo.done === 1;
  }

  function blank(value: string): boolean {
    return value.trim().length === 0;
  }

  async function addNote(): Promise<void> {
    if (blank(draft)) return;
    const title = draft;
    const nextPosition = Math.max(-1, ...notes.current.map((todo) => todo.position)) + 1;
    draft = "";
    await notes.execute(
      sql`INSERT INTO todos (title, done, position) VALUES (${title}, 0, ${nextPosition})`
    );
  }

  async function toggle(todo: Todo): Promise<void> {
    const next = isDone(todo) ? 0 : 1;
    await notes.execute(sql`UPDATE todos SET done = ${next} WHERE id = ${todo.id}`);
  }

  function beginEditing(todo: Todo): void {
    editingID = todo.id;
    editingTitle = todo.title;
  }

  async function save(todo: Todo): Promise<void> {
    if (blank(editingTitle)) {
      stopEditing();
      return;
    }
    const title = editingTitle;
    stopEditing();
    await notes.execute(sql`UPDATE todos SET title = ${title} WHERE id = ${todo.id}`);
  }

  function stopEditing(): void {
    editingID = null;
  }

  async function remove(todo: Todo): Promise<void> {
    await notes.execute(sql`DELETE FROM todos WHERE id = ${todo.id}`);
  }
</script>

<main class="archive-shell">
  <header class="archive-header">
    <div>
      <p class="archive-kicker">Relational field archive</p>
      <h1>Observations</h1>
      <p class="archive-deck">A working index whose records live in SQLite.</p>
    </div>
    <div class="archive-count" aria-label={`${notes.current.length} records`}>
      <strong>{String(notes.current.length).padStart(2, "0")}</strong>
      <span>records<br />on file</span>
    </div>
  </header>

  <div id="composer" class="archive-composer">
    <label for="sqlite-note-draft">New record</label>
    <input
      id="sqlite-note-draft"
      type="text"
      aria-label="New note"
      placeholder="Describe the observation…"
      bind:value={draft}
      onkeydown={(event) => {
        if (event.key === "Enter") void addNote();
      }}
    />
    <button onclick={() => void addNote()}>File record</button>
  </div>

  <div class="archive-columns" aria-hidden="true"><span>Accession</span><span>Record</span><span>State</span></div>
  <ol class="archive-list">
    {#each notes.current as todo (todo.id)}
      <li
        data-done={isDone(todo) ? "true" : "false"}
        data-editing={editingID === todo.id ? "true" : "false"}
      >
        <span class="accession" aria-hidden="true">LT–{String(todo.id).padStart(3, "0")}</span>
        <button
          class="record-state"
          aria-label={isDone(todo) ? "Mark incomplete" : "Mark complete"}
          onclick={() => void toggle(todo)}
        >
          <span aria-hidden="true">{isDone(todo) ? "✓" : ""}</span>
        </button>

        {#if editingID === todo.id}
          <input
            class="record-editor"
            type="text"
            bind:value={editingTitle}
            data-slop-inline-editor="true"
            aria-label="Edit {todo.title}"
            use:focusOnMount
            onkeydown={(event) => {
              if (event.key === "Enter") void save(todo);
              else if (event.key === "Escape") stopEditing();
            }}
          />
        {:else}
          <span
            class="record-copy"
            role="button"
            tabindex="0"
            aria-label="Edit {todo.title}"
            onclick={() => beginEditing(todo)}
            onkeydown={(event) => {
              if (event.key === "Enter" || event.key === " ") beginEditing(todo);
            }}
          >
            {todo.title}
          </span>
          <button class="delete-record" aria-label="Delete {todo.title}" onclick={() => void remove(todo)}>
            <span aria-hidden="true">×</span>
          </button>
        {/if}
        <span class="record-label">{isDone(todo) ? "Filed" : "Open"}</span>
      </li>
    {/each}
  </ol>

  {#if notes.current.length === 0 && !notes.isLoading}
    <div class="archive-empty"><strong>No records yet.</strong><span>File the first observation to begin the archive.</span></div>
  {/if}

  {#if notes.error}
    <p id="error" class="archive-error">The archive could not be updated. {notes.error}</p>
  {:else}
    <p id="status" class="archive-status">
      {#if notes.isLoading}
        Reading the archive…
      {:else}
        <span>{completedCount} filed</span><span>{notes.current.length - completedCount} open</span><span>Source: {notes.lastChangeSource}</span>
      {/if}
    </p>
  {/if}
  <footer class="archive-footer"><span>Main table / todos</span><span>data.sqlite · local & transactional</span></footer>
</main>
