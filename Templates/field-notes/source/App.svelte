<script lang="ts">
  import { Toolbar } from "bits-ui";
  import { jsonStore } from "@slop/svelte";

  type Todo = {
    id: number;
    title: string;
    done: boolean;
    position: number;
  };

  type TodoData = {
    title: string;
    subtitle: string;
    todos: Todo[];
    nextID: number;
  };

  type Filter = "all" | "open" | "done";

  const notes = jsonStore<TodoData>("state", {
    title: "Field notes",
    subtitle: "Small observations, kept close at hand.",
    todos: [],
    nextID: 1,
  });

  let draft = $state("");
  let editingID = $state<number | null>(null);
  let editingTitle = $state("");
  let editingHeaderTitle = $state(false);
  let editingHeaderSubtitle = $state(false);
  let headerTitleDraft = $state("");
  let headerSubtitleDraft = $state("");
  let filter = $state<Filter>("all");

  const completedCount = $derived(notes.current.todos.filter((todo) => todo.done).length);
  const visibleTodos = $derived(notes.current.todos.filter((todo) => {
    if (filter === "open") return !todo.done;
    if (filter === "done") return todo.done;
    return true;
  }));

  function focusOnMount(node: HTMLInputElement): { destroy: () => void } {
    const frame = requestAnimationFrame(() => node.focus());
    return { destroy: () => cancelAnimationFrame(frame) };
  }

  function blank(value: string): boolean {
    return value.trim().length === 0;
  }

  function addNote(): void {
    if (blank(draft)) return;
    const title = draft;
    notes.update((data) => {
      data.todos.push({
        id: data.nextID,
        title,
        done: false,
        position: data.todos.length,
      });
      data.nextID += 1;
    });
    draft = "";
  }

  function toggle(todo: Todo): void {
    notes.update((data) => {
      const row = data.todos.find((item) => item.id === todo.id);
      if (row) row.done = !row.done;
    });
  }

  function beginEditing(todo: Todo): void {
    saveEditingHeader();
    saveEditingNote();
    editingID = todo.id;
    editingTitle = todo.title;
  }

  function save(todo: Todo): void {
    if (blank(editingTitle)) {
      stopEditing();
      return;
    }
    const title = editingTitle;
    notes.update((data) => {
      const row = data.todos.find((item) => item.id === todo.id);
      if (row) row.title = title;
    });
    stopEditing();
  }

  function saveEditingNote(): void {
    if (editingID === null) return;
    const todo = notes.current.todos.find((item) => item.id === editingID);
    if (todo) save(todo);
  }

  function stopEditing(): void {
    editingID = null;
  }

  function beginEditingHeaderTitle(): void {
    saveEditingNote();
    saveEditingHeader();
    editingHeaderTitle = true;
    headerTitleDraft = notes.current.title;
  }

  function beginEditingHeaderSubtitle(): void {
    saveEditingNote();
    saveEditingHeader();
    editingHeaderSubtitle = true;
    headerSubtitleDraft = notes.current.subtitle;
  }

  function saveHeaderTitle(): void {
    if (!editingHeaderTitle) return;
    if (blank(headerTitleDraft)) {
      stopHeaderEditing();
      return;
    }
    const title = headerTitleDraft;
    notes.update((data) => {
      data.title = title;
    });
    stopHeaderEditing();
  }

  function saveHeaderSubtitle(): void {
    if (!editingHeaderSubtitle) return;
    const subtitle = headerSubtitleDraft;
    notes.update((data) => {
      data.subtitle = subtitle;
    });
    stopHeaderEditing();
  }

  function saveEditingHeader(): void {
    if (editingHeaderTitle) saveHeaderTitle();
    else if (editingHeaderSubtitle) saveHeaderSubtitle();
  }

  function stopHeaderEditing(): void {
    editingHeaderTitle = false;
    editingHeaderSubtitle = false;
  }

  function headerKey(event: KeyboardEvent, role: "title" | "subtitle"): void {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (role === "title") beginEditingHeaderTitle();
      else beginEditingHeaderSubtitle();
    }
  }
</script>

<main class="notes-shell" data-slop-selection="none">
  <header class="notes-header">
    {#if editingHeaderTitle}
      <input
        class="title-editor"
        type="text"
        bind:value={headerTitleDraft}
        data-slop-inline-editor="true"
        aria-label="Document title"
        use:focusOnMount
        onkeydown={(event) => {
          if (event.key === "Enter") saveHeaderTitle();
          else if (event.key === "Escape") stopHeaderEditing();
        }}
      />
    {:else}
      <button
        type="button"
        class="note-title"
        aria-label="Edit document title"
        onclick={beginEditingHeaderTitle}
        onkeydown={(event) => headerKey(event, "title")}
      >
        {notes.current.title}
      </button>
    {/if}

    {#if editingHeaderSubtitle}
      <input
        class="subtitle-editor"
        type="text"
        bind:value={headerSubtitleDraft}
        data-slop-inline-editor="true"
        aria-label="Document subtitle"
        use:focusOnMount
        onkeydown={(event) => {
          if (event.key === "Enter") saveHeaderSubtitle();
          else if (event.key === "Escape") stopHeaderEditing();
        }}
      />
    {:else}
      <button
        type="button"
        class="note-subtitle"
        aria-label="Edit document subtitle"
        onclick={beginEditingHeaderSubtitle}
        onkeydown={(event) => headerKey(event, "subtitle")}
      >
        {notes.current.subtitle || "Add a subtitle…"}
      </button>
    {/if}
  </header>

  <div id="composer" class="composer">
    <label for="field-note-draft">Next observation</label>
    <input
      id="field-note-draft"
      class="composer-input"
      type="text"
      aria-label="New note"
      placeholder="Write the next small thing…"
      bind:value={draft}
      onkeydown={(event) => {
        if (event.key === "Enter") addNote();
      }}
    />
    <button class="primary-action" onclick={addNote}>Add note</button>
  </div>

  <div class="notes-nav">
    <span>Field log</span>
    <Toolbar.Root aria-label="Filter observations">
      <Toolbar.Group type="single" value={filter} onValueChange={(value) => {
        if (value === "all" || value === "open" || value === "done") filter = value;
      }} class="filter-group">
        <Toolbar.GroupItem value="all" class="filter-button">All</Toolbar.GroupItem>
        <Toolbar.GroupItem value="open" class="filter-button">Open</Toolbar.GroupItem>
        <Toolbar.GroupItem value="done" class="filter-button">Filed</Toolbar.GroupItem>
      </Toolbar.Group>
    </Toolbar.Root>
  </div>

  <ul class="notes-list">
    {#each visibleTodos as todo (todo.id)}
      <li
        class="note-row"
        data-done={todo.done ? "true" : "false"}
        data-editing={editingID === todo.id ? "true" : "false"}
      >
        <button
          class="complete-action"
          aria-label={todo.done ? "Mark incomplete" : "Mark complete"}
          onclick={() => toggle(todo)}
        >
          ✓
        </button>

        {#if editingID === todo.id}
          <input
            class="note-editor"
            type="text"
            bind:value={editingTitle}
            data-slop-inline-editor="true"
            aria-label="Edit {todo.title}"
            use:focusOnMount
            onkeydown={(event) => {
              if (event.key === "Enter") save(todo);
              else if (event.key === "Escape") stopEditing();
            }}
          />
        {:else}
          <span
            class="note-copy"
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
          <button
            class="delete-note"
            aria-label="Delete {todo.title}"
            onclick={() => notes.update((data) => {
              data.todos = data.todos.filter((item) => item.id !== todo.id);
            })}
          >
            ×
          </button>
        {/if}
      </li>
    {/each}
  </ul>

  {#if visibleTodos.length === 0 && !notes.isLoading}
    <div class="notes-empty">
      <strong>{notes.current.todos.length === 0 ? "The page is open." : "Nothing in this tray."}</strong>
      <span>{notes.current.todos.length === 0 ? "Record the first small thing worth noticing." : "Change the filter or file another observation."}</span>
    </div>
  {/if}

  {#if notes.error}
    <p id="error" class="document-error">{notes.error}</p>
  {:else}
    <p id="status" class="document-status">
      {#if notes.isLoading}
        Opening your notes…
      {:else}
        {notes.current.todos.length} notes · {completedCount} finished
      {/if}
    </p>
  {/if}
  <footer class="document-footer"><span>Field folio № 08</span><span>Tap a note to edit</span></footer>
</main>
