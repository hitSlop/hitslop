<script lang="ts">
  import { Dialog, Tabs } from "bits-ui";
  import { jsonStore } from "@slop/svelte";
  import Pin from "@lucide/svelte/icons/pin";
  import Plus from "@lucide/svelte/icons/plus";
  import Trash2 from "@lucide/svelte/icons/trash-2";
  import X from "@lucide/svelte/icons/x";

  type Entry = { id: number; title: string; body: string; pinned: boolean; updatedAt: string };
  type NotebookData = { title: string; subtitle: string; entries: Entry[]; nextID: number };

  const notebook = jsonStore<NotebookData>("state", {
    title: "Softbound",
    subtitle: "A small place for unfinished thinking.",
    entries: [],
    nextID: 1,
  });

  let view = $state<"all" | "pinned">("all");
  let selectedID = $state<number | null>(null);
  let composing = $state(false);
  let draftTitle = $state("");
  let draftBody = $state("");

  const ordered = $derived([...notebook.current.entries]
    .filter((entry) => view === "all" || entry.pinned)
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt.localeCompare(a.updatedAt)));
  const selected = $derived(
    notebook.current.entries.find((entry) => entry.id === selectedID) ?? ordered[0] ?? null
  );

  $effect(() => {
    if (selected && selectedID === null) selectedID = selected.id;
    if (!selected && selectedID !== null) selectedID = ordered[0]?.id ?? null;
  });

  function createEntry(): void {
    const title = draftTitle.trim();
    if (!title) return;
    const body = draftBody.trim();
    const updatedAt = new Date().toISOString();
    const id = notebook.current.nextID;
    notebook.update((data) => {
      data.entries.unshift({ id: data.nextID, title, body, pinned: false, updatedAt });
      data.nextID += 1;
    });
    selectedID = id;
    draftTitle = "";
    draftBody = "";
    composing = false;
  }

  function updateEntry(id: number, field: "title" | "body", value: string): void {
    const updatedAt = new Date().toISOString();
    notebook.update((data) => {
      const entry = data.entries.find((item) => item.id === id);
      if (!entry) return;
      entry[field] = value;
      entry.updatedAt = updatedAt;
    });
  }

  function togglePin(id: number): void {
    const updatedAt = new Date().toISOString();
    notebook.update((data) => {
      const entry = data.entries.find((item) => item.id === id);
      if (entry) { entry.pinned = !entry.pinned; entry.updatedAt = updatedAt; }
    });
  }

  function removeEntry(id: number): void {
    notebook.update((data) => { data.entries = data.entries.filter((entry) => entry.id !== id); });
    selectedID = notebook.current.entries.find((entry) => entry.id !== id)?.id ?? null;
  }

  function shortDate(value: string): string {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "Today" : new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(date);
  }
</script>

<main class="book-shell" data-slop-selection="none">
  <header class="book-header">
    <div class="book-mark"><span>LT / NOTES</span><strong>{String(notebook.current.entries.length).padStart(2, "0")}</strong></div>
    <div class="book-title">
      <p>Commonplace notebook</p>
      <h1>{notebook.current.title}</h1>
      <span>{notebook.current.subtitle}</span>
    </div>
  </header>

  <section class="book-workspace">
    <aside class="book-index" aria-label="Notebook pages">
      <div class="index-tools">
        <Tabs.Root bind:value={view}>
          <Tabs.List class="index-tabs" aria-label="Filter notebook pages">
            <Tabs.Trigger value="all">All</Tabs.Trigger>
            <Tabs.Trigger value="pinned">Pinned</Tabs.Trigger>
          </Tabs.List>
        </Tabs.Root>
        <Dialog.Root bind:open={composing}>
          <Dialog.Trigger class="new-page" aria-label="New page"><Plus /></Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Overlay class="compose-overlay" />
            <Dialog.Content class="compose-card">
              <p>New leaf</p>
              <Dialog.Title>Start a page</Dialog.Title>
              <Dialog.Description>Give the thought a name. You can keep writing after it lands.</Dialog.Description>
              <label>Title<input bind:value={draftTitle} placeholder="A useful thought…" /></label>
              <label>Opening line<textarea bind:value={draftBody} placeholder="Begin anywhere."></textarea></label>
              <div class="compose-actions">
                <Dialog.Close>Cancel</Dialog.Close>
                <button onclick={createEntry}>Create page</button>
              </div>
              <Dialog.Close class="compose-close" aria-label="Close"><X /></Dialog.Close>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      </div>

      <ol>
        {#each ordered as entry, index (entry.id)}
          <li class:active={selected?.id === entry.id}>
            <button onclick={() => { selectedID = entry.id; }}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <strong>{entry.title}</strong>
              <small>{entry.pinned ? "Pinned" : shortDate(entry.updatedAt)}</small>
            </button>
          </li>
        {/each}
      </ol>
    </aside>

    <article class="page-editor">
      {#if selected}
        <div class="page-meta"><span>{shortDate(selected.updatedAt)}</span><span>{selected.body.length} characters</span></div>
        <input class="page-title" value={selected.title} aria-label="Page title" onchange={(event) => updateEntry(selected.id, "title", event.currentTarget.value)} />
        <textarea class="page-body" value={selected.body} aria-label="Page body" placeholder="Write without arranging it first…" onchange={(event) => updateEntry(selected.id, "body", event.currentTarget.value)}></textarea>
        <div class="page-actions">
          <button class:active={selected.pinned} onclick={() => togglePin(selected.id)}><Pin />{selected.pinned ? "Pinned" : "Pin page"}</button>
          <button class="delete-page" onclick={() => removeEntry(selected.id)}><Trash2 />Delete</button>
        </div>
      {:else}
        <div class="page-empty"><strong>Open the first page.</strong><span>Use the plus button to catch a thought before it leaves.</span></div>
      {/if}
    </article>
  </section>

  {#if notebook.error}<p class="book-error">The notebook could not be saved. {notebook.error}</p>{/if}
</main>
