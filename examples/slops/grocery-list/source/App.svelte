<script lang="ts">
  import { capture } from "@hitslop/runtime";
  import { jsonStore } from "@hitslop/svelte";
  import Plus from "@lucide/svelte/icons/plus";
  import Trash2 from "@lucide/svelte/icons/trash-2";
  import Icon from "./Icon.svelte";

  type GroceryItem = {
    id: string;
    text: string;
    category: string;
    done: boolean;
  };

  type GroceryData = {
    title: string;
    stickyNote: string;
    items: GroceryItem[];
  };

  const CATEGORIES = ["Produce", "Dairy", "Bakery", "Pantry", "Household", "Other"];

  const doc = jsonStore<GroceryData>({
    title: "Groceries",
    stickyNote: "Don't forget coffee! ❤️",
    items: [
      { id: "1", text: "Organic Whole Milk", category: "Dairy", done: true },
      { id: "2", text: "Pasture Eggs (dozen)", category: "Dairy", done: true },
      { id: "3", text: "Sourdough Loaf", category: "Bakery", done: false },
      { id: "4", text: "Hass Avocados", category: "Produce", done: false },
      { id: "5", text: "Cherry Tomatoes", category: "Produce", done: false },
      { id: "6", text: "Baby Spinach", category: "Produce", done: false },
      { id: "7", text: "Oat Barista Milk", category: "Dairy", done: false },
      { id: "8", text: "Olive Oil", category: "Pantry", done: false },
    ],
  });

  let activeFilter = $state("All");
  let newItemText = $state("");
  let newItemCategory = $state("Produce");

  const filteredItems = $derived(
    activeFilter === "All"
      ? doc.current.items
      : doc.current.items.filter((item) => item.category === activeFilter)
  );

  const doneCount = $derived(doc.current.items.filter((i) => i.done).length);
  const totalCount = $derived(doc.current.items.length);

  function addItem() {
    const text = newItemText.trim();
    if (!text) return;
    doc.current.items.push({
      id: crypto.randomUUID(),
      text,
      category: newItemCategory,
      done: false,
    });
    newItemText = "";
  }

  function removeItem(id: string) {
    doc.current.items = doc.current.items.filter((item) => item.id !== id);
  }

  function clearDone() {
    doc.current.items = doc.current.items.filter((item) => !item.done);
  }
</script>

<main class="fridge-canvas">
  <div class="fridge-door">
    <!-- Magnets on the right margin -->
    <div class="magnet magnet-banana" aria-hidden="true">
      <div class="banana-body">
        <span class="banana-tip-left"></span>
        <span class="banana-tip-right"></span>
      </div>
    </div>

    <div class="magnet magnet-smiley" aria-hidden="true">
      <span>😊</span>
    </div>

    <div class="magnet magnet-star" aria-hidden="true">★</div>

    <!-- Paper Shopping Pad -->
    <article class="notepad">
      <div class="pad-title-row">
        <input
          class="pad-title-input"
          aria-label="List title"
          bind:value={doc.current.title}
        />
        <span class="pad-count">{doneCount}/{totalCount} done</span>
      </div>

      <!-- Category Filter Tabs -->
      <div class="filter-tabs" data-slop-export="hide">
        <button
          type="button"
          class="filter-tab"
          class:active={activeFilter === "All"}
          onclick={() => (activeFilter = "All")}
        >All</button>
        {#each CATEGORIES as cat}
          <button
            type="button"
            class="filter-tab"
            class:active={activeFilter === cat}
            onclick={() => (activeFilter = cat)}
          >{cat}</button>
        {/each}
      </div>

      <!-- Quick Add Row -->
      <form
        class="add-item-row"
        data-slop-export="hide"
        onsubmit={(e) => { e.preventDefault(); addItem(); }}
      >
        <input
          class="new-item-input"
          placeholder="Add an item and press Enter..."
          aria-label="Add grocery item"
          bind:value={newItemText}
        />
        <select
          class="section-select"
          aria-label="Category for new item"
          bind:value={newItemCategory}
        >
          {#each CATEGORIES as cat}
            <option value={cat}>{cat}</option>
          {/each}
        </select>
        <button type="submit" class="add-btn" aria-label="Add item">
          <Plus size={14} />
        </button>
      </form>

      <!-- Checklist Items -->
      <ul class="items-list">
        {#each filteredItems as item (item.id)}
          <li class="item-row" class:done={item.done}>
            <input
              type="checkbox"
              class="item-check"
              aria-label="Mark {item.text} done"
              bind:checked={item.done}
            />
            <input
              class="item-title-input"
              aria-label="Grocery item text"
              bind:value={item.text}
            />
            <span class="item-badge">{item.category}</span>
            <button
              class="delete-item-btn"
              data-slop-export="hide"
              aria-label="Delete {item.text}"
              onclick={() => removeItem(item.id)}
            >
              <Trash2 size={12} />
            </button>
          </li>
        {/each}
      </ul>
    </article>

    <!-- Pinned Sticky Note -->
    <aside class="sticky-note">
      <span class="sticky-pin" aria-hidden="true"></span>
      <textarea
        class="sticky-textarea"
        aria-label="Sticky reminder memo"
        bind:value={doc.current.stickyNote}
      ></textarea>
    </aside>
  </div>
</main>

{#if capture.isRenderer()}
  <Icon />
{/if}
