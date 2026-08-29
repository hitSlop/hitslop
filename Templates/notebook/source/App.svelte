<script lang="ts">
  import { Dialog, Label, Select, Separator } from "bits-ui";
  import { jsonStore } from "@slop/svelte";
  import Check from "@lucide/svelte/icons/check";
  import ChevronsUpDown from "@lucide/svelte/icons/chevrons-up-down";
  import Plus from "@lucide/svelte/icons/plus";
  import X from "@lucide/svelte/icons/x";

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
    title: "Notebook",
    subtitle: "Local notes with a live theme overlay.",
    todos: [],
    nextID: 1,
  });

  const filters: { value: Filter; label: string }[] = [
    { value: "all", label: "All notes" },
    { value: "open", label: "Open" },
    { value: "done", label: "Finished" },
  ];

  let filter = $state<Filter>("all");
  let composerOpen = $state(false);
  let draft = $state("");
  let editingID = $state<number | null>(null);
  let editingTitle = $state("");
  let editingHeaderTitle = $state(false);
  let editingHeaderSubtitle = $state(false);
  let headerTitleDraft = $state("");
  let headerSubtitleDraft = $state("");

  const completedCount = $derived(notes.current.todos.filter((todo) => todo.done).length);
  const visibleTodos = $derived(
    notes.current.todos.filter((todo) => {
      if (filter === "open") return !todo.done;
      if (filter === "done") return todo.done;
      return true;
    })
  );

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
    composerOpen = false;
  }

  function toggle(todo: Todo): void {
    notes.update((data) => {
      const row = data.todos.find((item) => item.id === todo.id);
      if (row) row.done = !row.done;
    });
  }

  function beginEditing(todo: Todo): void {
    saveEditingHeader();
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

  function stopEditing(): void {
    editingID = null;
  }

  function beginEditingHeaderTitle(): void {
    stopEditing();
    saveEditingHeader();
    editingHeaderTitle = true;
    headerTitleDraft = notes.current.title;
  }

  function beginEditingHeaderSubtitle(): void {
    stopEditing();
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

<main class="notebook-shell">
  <header class="notebook-header">
    <div class="notebook-index" aria-hidden="true">
      <span>Commonplace</span>
      <strong>{String(notes.current.todos.length).padStart(2, "0")}</strong>
    </div>
    <div class="notebook-heading">
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
        class="notebook-title"
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
        class="notebook-subtitle"
        aria-label="Edit document subtitle"
        onclick={beginEditingHeaderSubtitle}
        onkeydown={(event) => headerKey(event, "subtitle")}
      >
        {notes.current.subtitle || "Add a subtitle…"}
      </button>
    {/if}
    </div>
  </header>

  <div class="notebook-tools">
    <Select.Root type="single" bind:value={filter} items={filters}>
      <Select.Trigger
        class="filter-trigger"
        aria-label="Filter notes"
      >
        <Select.Value placeholder="Filter" />
        <ChevronsUpDown class="filter-caret" strokeWidth={1.75} absoluteStrokeWidth />
      </Select.Trigger>
      <Select.Portal>
        <Select.Content
          class="filter-menu"
          sideOffset={8}
        >
          <Select.Viewport>
            {#each filters as item (item.value)}
              <Select.Item
                class="filter-option"
                value={item.value}
                label={item.label}
              >
                {#snippet children({ selected })}
                  {item.label}
                  {#if selected}
                    <Check class="filter-check" strokeWidth={1.75} absoluteStrokeWidth />
                  {/if}
                {/snippet}
              </Select.Item>
            {/each}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>

    <Dialog.Root bind:open={composerOpen}>
      <Dialog.Trigger
        class="compose-trigger"
      >
        <Plus aria-hidden="true" strokeWidth={1.75} absoluteStrokeWidth />
        New note
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay class="compose-overlay" />
        <Dialog.Content class="compose-sheet">
          <p class="compose-kicker">New commonplace</p>
          <Dialog.Title>Capture a thought</Dialog.Title>
          <Dialog.Description>It stays with this notebook in data.json.</Dialog.Description>
          <Separator.Root class="compose-rule" />
          <Label.Root for="note-draft" class="compose-label">Note</Label.Root>
          <input
            id="note-draft"
            class="compose-input"
            placeholder="What is worth remembering?"
            bind:value={draft}
            use:focusOnMount
            onkeydown={(event) => {
              if (event.key === "Enter") addNote();
            }}
          />
          <div class="compose-actions">
            <Dialog.Close class="compose-cancel">
              Keep browsing
            </Dialog.Close>
            <button
              type="button"
              class="compose-save"
              onclick={addNote}
            >
              Save note
            </button>
          </div>
          <Dialog.Close class="compose-close" aria-label="Close note composer">
            <X strokeWidth={1.75} absoluteStrokeWidth />
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  </div>

  {#if visibleTodos.length === 0}
    <div class="notebook-empty">
      <span aria-hidden="true">∅</span>
      <p>{filter === "all" ? "The first page is waiting. Capture a thought worth returning to." : "No notes match this view. Choose another filter or add a note."}</p>
    </div>
  {:else}
    <ol class="notebook-list">
      {#each visibleTodos as todo, index (todo.id)}
        <li class:done={todo.done}>
          <span class="note-index" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
          <button
            class="note-check"
            aria-label={todo.done ? "Mark incomplete" : "Mark complete"}
            onclick={() => toggle(todo)}
          >
            <span aria-hidden="true">{todo.done ? "✓" : ""}</span>
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
              <X aria-hidden="true" strokeWidth={1.75} absoluteStrokeWidth />
            </button>
          {/if}
        </li>
      {/each}
    </ol>
  {/if}

  {#if notes.error}
    <p class="notebook-error">The notebook could not be saved. {notes.error}</p>
  {:else}
    <footer class="notebook-status">
      {#if notes.isLoading}
        <span>Opening the notebook…</span>
      {:else}
        <span>{visibleTodos.length} shown</span><span>{completedCount} finished</span><span>Local JSON</span>
      {/if}
    </footer>
  {/if}
</main>
