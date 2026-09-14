<script lang="ts">
  import type { ReadingTracker } from "../schema";
  import BookOpen from "@lucide/svelte/icons/book-open";
  import Star from "@lucide/svelte/icons/star";
  import * as s from "./styles.css";

  const STARS = [1, 2, 3, 4, 5] as const;
  let { data }: { data: ReadingTracker } = $props();
  const total = $derived(data.books.length);
  const returned = $derived(data.books.filter(book => book.status === "Read").length);
</script>

<article class={s.exportCard} aria-label="Exported reading list">
  <header class={s.header}>
    <div class={s.identity}>
      <h1 class={s.masthead}>Reading list</h1>
      <div class={s.memberRow}>
        <span class={s.memberName}>{data.memberName.trim() || "Cardholder"}</span>
        {#if data.memberName.trim() && data.memberSince.trim()}<span aria-hidden="true">·</span>{/if}
        <span class={s.memberSince}>{data.memberSince}</span>
      </div>
    </div>
<div class={s.finishedCount} aria-label="{returned} books finished"><strong>{returned}</strong><span>finished</span></div>
  </header>

  <div class={s.ledger}>
    <div class={s.head} aria-hidden="true">
      <span>Title</span>
      <span>Author</span>
      <span>Rating</span>
      <span>Status</span>
    </div>
    <ul class={s.list} aria-label="Reading list">
      {#each data.books as book (book.id)}
        <li class={s.exportRow}>
          <span class={s.bookSpine} data-status={book.status} aria-hidden="true"><BookOpen size={19} strokeWidth={1.5} /></span>
          <div class={s.bookInfo}>
          <span class={s.titleCell}>{book.title.trim() || "Untitled book"}</span>
          <span class={s.authorCell}>{book.author.trim() || "Unknown Author"}</span></div>
          <span class={s.stars} aria-label="{book.rating} of 5 stars">
            {#each STARS as star}
              <span class={s.star} data-filled={star <= book.rating} aria-hidden="true"><Star size={15} fill={star <= book.rating ? "currentColor" : "none"} strokeWidth={1.6} /></span>
            {/each}
          </span>
          <span class={s.statusPill} data-status={book.status}>{book.status || "To Read"}</span>
          {#if book.notes?.trim()}<div class={s.exportNotes}><strong>Notes</strong><p>{book.notes}</p></div>{/if}
        </li>
      {:else}
        <li class={s.empty}><h2>Your next chapter starts here.</h2></li>
      {/each}
    </ul>
  </div>

  <footer class={s.foot}>
    <span>{returned} of {total} books finished</span>
    <span>One book at a time.</span>
  </footer>
</article>
