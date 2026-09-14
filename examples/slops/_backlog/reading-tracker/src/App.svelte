<script lang="ts">
  import { ready } from "@hitslop/runtime";
  import { jsonStore, IconTarget, ExportTarget } from "@hitslop/svelte";
  import { onDestroy } from "svelte";
  import { prefersReducedMotion } from "svelte/motion";
  import { flip } from "svelte/animate";
  import { RadioGroup, Select, ToggleGroup, Button, Dialog } from "bits-ui";
  import MessageSquareText from "@lucide/svelte/icons/message-square-text";
  import X from "@lucide/svelte/icons/x";
  import Plus from "@lucide/svelte/icons/plus";
  import Trash2 from "@lucide/svelte/icons/trash-2";
  import Check from "@lucide/svelte/icons/check";
  import readingSchema from "../schema";
  import type { ReadingTracker } from "../schema";
  import Icon from "./Icon.svelte";
  import Export from "./Export.svelte";
  import { grow } from "./grow";
  import BookOpen from "@lucide/svelte/icons/book-open";
  import Star from "@lucide/svelte/icons/star";
  import * as s from "./styles.css";

  const STATUSES = ["To Read", "Reading", "Read"] as const;
  type Status = typeof STATUSES[number];
  const statusItems = STATUSES.map(value => ({ value, label: value }));
  const STARS = [1, 2, 3, 4, 5] as const;
  type Book = ReadingTracker["books"][number];

  const doc = jsonStore({ schema: readingSchema, initial: {
    memberName: "Jamie Park",
    memberSince: "Member since 2023",
    books: [
      { id: "1", title: "Atomic Habits", author: "James Clear", rating: 5, status: "Read" },
      { id: "2", title: "The Alchemist", author: "P. Coelho", rating: 5, status: "Read" },
      { id: "3", title: "Sapiens", author: "Yuval Noah Harari", rating: 4, status: "Reading" },
      { id: "4", title: "Deep Work", author: "Cal Newport", rating: 5, status: "To Read" },
      { id: "5", title: "The Creative Act", author: "Rick Rubin", rating: 4, status: "To Read" },
    ],
  } });

  let newTitle = $state("");
  let newAuthor = $state("");
  let newStatus = $state<Status>("To Read");
  let notesOpen = $state(false);
  let notesBookId = $state<string | null>(null);
  let notesDraft = $state("");
  const notesBook = $derived(doc.current.books.find(book => book.id === notesBookId));
  function openNotes(book: Book) {
    notesBookId = book.id;
    notesDraft = book.notes ?? "";
    notesOpen = true;
  }
  function saveNotes() {
    if (!notesBook) return;
    notesBook.notes = notesDraft;
    notesOpen = false;
  }
  let composer = $state<HTMLInputElement>();
  $effect(() => { if (doc.isReady) ready(); });
  onDestroy(() => doc.destroy());

  const totalBooks = $derived(doc.current.books.length);
  const readBooks = $derived(doc.current.books.filter(book => book.status === "Read").length);
  const flipMs = $derived(prefersReducedMotion.current ? 0 : 220);

  function isStatus(value: string): value is Status {
    return STATUSES.includes(value as Status);
  }
  function addBook() {
    const title = newTitle.trim();
    if (!title || doc.isLoading) return;
    doc.current.books.push({
      id: crypto.randomUUID(),
      title,
      author: newAuthor.trim() || "Unknown Author",
      rating: 0,
      status: newStatus,
      notes: "",
    });
    newTitle = "";
    newAuthor = "";
    composer?.focus();
  }
  function removeBook(id: string) {
    doc.current.books = doc.current.books.filter(book => book.id !== id);
  }
  function setRating(book: Book, value: string) {
    const next = Number(value);
    if (next >= 1 && next <= 5) book.rating = next;
  }
</script>

<main class={s.card} data-slop-selection="none" aria-busy={doc.isLoading} aria-label="Personal reading list">
  <article class={s.pocket} inert={!doc.isReady || doc.isLoading}>
    <header class={s.header}>
      <div class={s.identity}>
        <h1 class={s.masthead}>Reading list</h1>
        <div class={s.memberRow}>
          <input class={s.memberName} aria-label="Reader name" bind:value={doc.current.memberName} placeholder="Your name" />
          <span aria-hidden="true">·</span>
          <input class={s.memberSince} aria-label="Reading note" bind:value={doc.current.memberSince} placeholder="A note about your reading" />
        </div>
      </div>
<div class={s.finishedCount} aria-label="{readBooks} books finished"><strong>{readBooks}</strong><span>finished</span></div>
    </header>

    <form class={s.composer} data-slop-export="hide" onsubmit={event => { event.preventDefault(); addBook(); }}>
      <input bind:this={composer} class={s.titleDraft} aria-label="New book title" placeholder="Book title…" bind:value={newTitle} disabled={doc.isLoading} />
      <input class={s.authorDraft} aria-label="New book author" placeholder="Author…" bind:value={newAuthor} disabled={doc.isLoading} />
      <ToggleGroup.Root
        type="single"
        value={newStatus}
        onValueChange={value => { if (isStatus(value)) newStatus = value; }}
        class={s.statusGroup}
        aria-label="Status for new book"
      >
        {#each STATUSES as status}
          <ToggleGroup.Item value={status} class={s.statusStamp}>{status}</ToggleGroup.Item>
        {/each}
      </ToggleGroup.Root>
      <Button.Root class={s.add} type="submit" aria-label="Add book" disabled={!newTitle.trim() || doc.isLoading}>
        <Plus size={13} />
        <span>Add</span>
      </Button.Root>
    </form>

    <div class={s.ledger}>
      <div class={s.head} aria-hidden="true">
        <span>Title</span>
        <span>Author</span>
        <span>Rating</span>
        <span>Status</span>
        <span data-slop-export="hide"></span>
      </div>
      <ul class={s.list} aria-label="Reading list">
        {#each doc.current.books as book (book.id)}
          <li class={s.row} data-status={book.status} animate:flip={{ duration: flipMs }}>
            <span class={s.bookSpine} data-status={book.status} aria-hidden="true"><BookOpen size={19} strokeWidth={1.5} /></span>
            <div class={s.bookInfo}>
            <textarea rows="1" use:grow={book.title} class={s.titleCell} aria-label="Book title" bind:value={book.title}></textarea>
            <input class={s.authorCell} aria-label="Author" bind:value={book.author} />
            </div>
            <RadioGroup.Root
              class={s.stars}
              orientation="horizontal"
              value={String(book.rating)}
              onValueChange={value => setRating(book, value)}
              aria-label="Rating for {book.title || 'untitled book'}{book.rating ? '' : ', not yet rated'}"
            >
              {#each STARS as star}
                <RadioGroup.Item
                  value={String(star)}
                  class={s.star}
                  data-filled={star <= book.rating}
                  aria-label="{star} {star === 1 ? 'star' : 'stars'}"
                ><Star size={15} fill={star <= book.rating ? "currentColor" : "none"} strokeWidth={1.6} /></RadioGroup.Item>
              {/each}
            </RadioGroup.Root>
            <Select.Root type="single" value={book.status} items={statusItems} onValueChange={value => { if (isStatus(value)) book.status = value; }}>
              <Select.Trigger class={s.statusPill} data-status={book.status} aria-label="Status for {book.title || 'untitled book'}">
                <Select.Value placeholder="Status" />
              </Select.Trigger>
              <Select.Portal>
                <Select.Content class={s.selectContent} sideOffset={6} data-slop-export="hide">
                  <Select.Viewport>
                    {#each statusItems as item (item.value)}
                      <Select.Item value={item.value} label={item.label}>
                        {#snippet children({ selected })}
                          {item.label}{#if selected}<Check size={12} strokeWidth={2.4} />{/if}
                        {/snippet}
                      </Select.Item>
                    {/each}
                  </Select.Viewport>
                </Select.Content>
              </Select.Portal>
            </Select.Root>
            <Button.Root class={s.noteButton} type="button" data-slop-export="hide" aria-label="{book.notes?.trim() ? 'Edit notes' : 'Add notes'} for {book.title || 'untitled book'}" onclick={() => openNotes(book)}><MessageSquareText size={14} /><span>{book.notes?.trim() ? "Notes" : "Add note"}</span></Button.Root>
            <Button.Root
              class={s.remove}
              type="button"
              data-slop-export="hide"
              aria-label="Delete {book.title || 'untitled book'}"
              onclick={() => removeBook(book.id)}
            >
              <Trash2 size={13} />
            </Button.Root>
          </li>
        {:else}
          <li class={s.empty}>
            <h2>Your next chapter starts here.</h2>
            <p>Add a book you want to read, or one you’ve already loved.</p>
          </li>
        {/each}
      </ul>
    </div>

    <footer class={s.foot}>
      <span>{readBooks} of {totalBooks} books finished</span>
      <span>One book at a time.</span>
    </footer>
  </article>

  {#if doc.error}
    <div class={s.error} role="alert">
      <span>{doc.isReady ? "Changes haven’t been saved." : "Your card couldn’t be loaded."} {doc.error}</span>
      <button data-slop-export="hide" onclick={() => { if (doc.isReady) void doc.flush().catch(() => undefined); else void doc.reload(); }}>Try again</button>
    </div>
  {:else if doc.isLoading}<p class={s.error} role="status">Loading your card…</p>{/if}
</main>

<Dialog.Root bind:open={notesOpen}>
  <Dialog.Portal>
    <Dialog.Overlay class={s.notesOverlay} data-slop-export="hide" />
    <Dialog.Content class={s.notesDialog} data-slop-export="hide">
      <form onsubmit={event => { event.preventDefault(); saveNotes(); }}>
        <header class={s.notesHeader}>
          <Dialog.Title class={s.notesTitle}>Notes on {notesBook?.title || "this book"}</Dialog.Title>
          <Dialog.Close class={s.notesClose} type="button" aria-label="Close notes"><X size={18} /></Dialog.Close>
        </header>
        <Dialog.Description class={s.notesDescription}>Thoughts, favorite passages, or something to come back to.</Dialog.Description>
        <label class={s.notesLabel} for="book-notes">Your notes</label>
        <textarea id="book-notes" class={s.notesInput} bind:value={notesDraft} placeholder="What stayed with you?" rows="8"></textarea>
        <footer class={s.notesActions}>
          <Dialog.Close class={s.notesCancel} type="button">Cancel</Dialog.Close>
          <Button.Root class={s.notesSave} type="submit" disabled={!notesBook}>Save notes</Button.Root>
        </footer>
      </form>
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>

<IconTarget><Icon completed={readBooks} total={totalBooks} /></IconTarget>
<ExportTarget><Export data={doc.current} /></ExportTarget>
