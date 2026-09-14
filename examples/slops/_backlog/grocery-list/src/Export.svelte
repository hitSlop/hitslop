<script lang="ts">
  import Check from "@lucide/svelte/icons/check";
  import type { GroceryList } from "../schema";
  import * as s from "./styles.css";

  let { list, filter }: { list: GroceryList; filter: string } = $props();
  const items = $derived(filter === "All" ? list.items : list.items.filter(item => item.category === filter));
  const done = $derived(items.filter(item => item.done).length);
</script>

<article class={s.exportDoor} aria-label="Exported grocery list">
  <section class={s.notepad}>
    <div class={s.titleRow}>
      <h1 class={s.title}>{list.title || "Groceries"}</h1>
      <span class={s.count}>{done}/{items.length} done</span>
    </div>
    <ul class={s.list}>
      {#each items as item (item.id)}
        <li class={s.row} data-done={item.done}>
          <span data-checkbox-root data-state={item.done ? "checked" : "unchecked"}>{#if item.done}<Check size={10} strokeWidth={3} />{/if}</span>
          <span class={s.itemText}>{item.text || "Untitled item"}</span>
          <span class={s.badge}>{item.category}</span>
        </li>
      {:else}
        <li class={s.empty}><h2>Nothing to pack yet.</h2></li>
      {/each}
    </ul>
  </section>
  {#if list.stickyNote.trim()}
    <aside class={s.sticky}>
      <span class={s.pin} aria-hidden="true"></span>
      <p class={s.memo} style:white-space="pre-wrap">{list.stickyNote}</p>
    </aside>
  {/if}
</article>
