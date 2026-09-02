<script lang="ts">
  import { capture } from "@hitslop/runtime";
  import { jsonStore } from "@hitslop/svelte";
  import Plus from "@lucide/svelte/icons/plus";
  import Trash2 from "@lucide/svelte/icons/trash-2";
  import Icon from "./Icon.svelte";

  type Book = {
    id: string;
    title: string;
    author: string;
    rating: number;
    status: "Read" | "Reading" | "To Read";
  };

  type ReadingData = {
    memberName: string;
    memberSince: string;
    books: Book[];
  };

  const STATUS_OPTIONS: Book["status"][] = ["Read", "Reading", "To Read"];

  const doc = jsonStore<ReadingData>({
    memberName: "Jamie Park",
    memberSince: "Member since 2023",
    books: [
      { id: "1", title: "Atomic Habits", author: "James Clear", rating: 5, status: "Read" },
      { id: "2", title: "The Alchemist", author: "P. Coelho", rating: 5, status: "Read" },
      { id: "3", title: "Sapiens", author: "Yuval Noah Harari", rating: 4, status: "Reading" },
      { id: "4", title: "Deep Work", author: "Cal Newport", rating: 5, status: "To Read" },
      { id: "5", title: "The Creative Act", author: "Rick Rubin", rating: 4, status: "To Read" },
    ],
  });

  let newTitle = $state("");
  let newAuthor = $state("");
  let newRating = $state(5);
  let newStatus = $state<Book["status"]>("To Read");

  const totalBooks = $derived(doc.current.books.length);
  const readBooks = $derived(doc.current.books.filter((b) => b.status === "Read").length);

  function addBook() {
    const title = newTitle.trim();
    if (!title) return;
    doc.current.books.push({
      id: crypto.randomUUID(),
      title,
      author: newAuthor.trim() || "Unknown Author",
      rating: newRating,
      status: newStatus,
    });
    newTitle = "";
    newAuthor = "";
  }

  function removeBook(id: string) {
    doc.current.books = doc.current.books.filter((b) => b.id !== id);
  }

  function setRating(book: Book, rating: number) {
    book.rating = rating;
  }
</script>

<main class="library-canvas">
  <article class="library-card">
    <!-- Header with Library Stamp -->
    <header class="card-header-row">
      <div class="header-left">
        <h1 class="card-masthead">LIBRARY CARD</h1>
        <div class="member-info-row">
          <input
            class="member-name-input"
            aria-label="Cardholder name"
            bind:value={doc.current.memberName}
          />
          <span>·</span>
          <input
            class="since-input"
            aria-label="Membership year"
            bind:value={doc.current.memberSince}
          />
        </div>
      </div>

      <div class="library-stamp" aria-label="Official Library Stamp">
        <span class="stamp-text-top">HITSLOP</span>
        <span class="stamp-star">★</span>
        <span class="stamp-text-bottom">LIBRARY</span>
      </div>
    </header>

    <!-- Quick Add Row -->
    <form
      class="add-book-row"
      data-slop-export="hide"
      onsubmit={(e) => { e.preventDefault(); addBook(); }}
    >
      <input
        class="add-input add-title-input"
        placeholder="Book title..."
        aria-label="New book title"
        bind:value={newTitle}
      />
      <input
        class="add-input add-author-input"
        placeholder="Author..."
        aria-label="New book author"
        bind:value={newAuthor}
      />
      <select
        class="add-input"
        aria-label="Initial status"
        bind:value={newStatus}
      >
        {#each STATUS_OPTIONS as opt}
          <option value={opt}>{opt}</option>
        {/each}
      </select>
      <button type="submit" class="add-book-btn" aria-label="Add book">
        <Plus size={13} />
        <span>Add</span>
      </button>
    </form>

    <!-- Books Table -->
    <div class="books-table-wrapper">
      <table class="books-table" aria-label="Reading list">
        <thead>
          <tr>
            <th style="width: 40%;">Title</th>
            <th style="width: 25%;">Author</th>
            <th style="width: 18%;">Rating</th>
            <th style="width: 17%;">Status</th>
            <th data-slop-export="hide" style="width: 28px;"></th>
          </tr>
        </thead>
        <tbody>
          {#each doc.current.books as book (book.id)}
            <tr>
              <td class="book-title-cell">
                <input
                  class="cell-input"
                  aria-label="Book title"
                  bind:value={book.title}
                />
              </td>
              <td class="book-author-cell">
                <input
                  class="cell-input"
                  aria-label="Author"
                  bind:value={book.author}
                />
              </td>
              <td>
                <div class="star-rating" role="radiogroup" aria-label="Rating for {book.title}">
                  {#each [1, 2, 3, 4, 5] as star}
                    <button
                      type="button"
                      class="star-btn"
                      class:filled={star <= book.rating}
                      onclick={() => setRating(book, star)}
                      aria-label="{star} stars"
                    >★</button>
                  {/each}
                </div>
              </td>
              <td>
                <select
                  class="status-pill"
                  class:read={book.status === "Read"}
                  class:reading={book.status === "Reading"}
                  aria-label="Status for {book.title}"
                  bind:value={book.status}
                >
                  {#each STATUS_OPTIONS as opt}
                    <option value={opt}>{opt}</option>
                  {/each}
                </select>
              </td>
              <td data-slop-export="hide">
                <button
                  type="button"
                  class="delete-row-btn"
                  aria-label="Delete {book.title}"
                  onclick={() => removeBook(book.id)}
                >
                  <Trash2 size={13} />
                </button>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>

    <!-- Footer -->
    <footer class="card-footer">
      <span>{readBooks} of {totalBooks} books completed</span>
      <span>Keep learning. Keep growing.</span>
    </footer>
  </article>
</main>

{#if capture.isRenderer()}
  <Icon />
{/if}
