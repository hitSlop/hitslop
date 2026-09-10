<script lang="ts">
  import { ready } from "@hitslop/runtime";
  import { jsonStore, IconTarget, ExportTarget } from "@hitslop/svelte";
  import { onDestroy } from "svelte";
  import { prefersReducedMotion } from "svelte/motion";
  import { flip } from "svelte/animate";
  import { Tabs, Checkbox, Select, Button, Tooltip } from "bits-ui";
  import Plus from "@lucide/svelte/icons/plus";
  import Trash2 from "@lucide/svelte/icons/trash-2";
  import Check from "@lucide/svelte/icons/check";
  import ChevronDown from "@lucide/svelte/icons/chevron-down";
  import grocerySchema from "../schema";
  import type { GroceryList } from "../schema";
  import Icon from "./Icon.svelte";
  import Export from "./Export.svelte";
  import * as s from "./styles.css";

  const CATEGORIES = ["Produce", "Dairy", "Bakery", "Pantry", "Household", "Other"] as const;
  type Category = typeof CATEGORIES[number];
  const categoryItems = CATEGORIES.map(value => ({ value, label: value }));

  const doc = jsonStore({ schema: grocerySchema, initial: {
    title: "Groceries",
    stickyNote: "Don't forget coffee!",
    items: [
      { id: "milk", text: "Organic whole milk", category: "Dairy", done: true },
      { id: "eggs", text: "Pasture eggs (dozen)", category: "Dairy", done: true },
      { id: "loaf", text: "Sourdough loaf", category: "Bakery", done: false },
      { id: "avos", text: "Hass avocados", category: "Produce", done: false },
      { id: "tomatoes", text: "Cherry tomatoes", category: "Produce", done: false },
      { id: "spinach", text: "Baby spinach", category: "Produce", done: false },
      { id: "oat", text: "Oat barista milk", category: "Dairy", done: false },
      { id: "oil", text: "Olive oil", category: "Pantry", done: false },
    ],
  } });

  let filter = $state<"All" | Category>("All");
  let draft = $state("");
  let aisle = $state<Category>("Produce");
  let composer = $state<HTMLInputElement>();
  $effect(() => { if (doc.isReady) ready(); });
  onDestroy(() => doc.destroy());

  const visible = $derived(filter === "All" ? doc.current.items : doc.current.items.filter(item => item.category === filter));
  const doneCount = $derived(doc.current.items.filter(item => item.done).length);
  const totalCount = $derived(doc.current.items.length);

  function addItem() {
    const text = draft.trim();
    if (!text || doc.isLoading) return;
    doc.current.items.push({ id: crypto.randomUUID(), text, category: aisle, done: false });
    draft = "";
    composer?.focus();
  }
  function removeItem(id: string) {
    doc.current.items = doc.current.items.filter(item => item.id !== id);
  }
  function clearDone() {
    doc.current.items = doc.current.items.filter(item => !item.done);
  }
  function isCategory(value: string): value is Category {
    return CATEGORIES.includes(value as Category);
  }
  const flipMs = $derived(prefersReducedMotion.current ? 0 : 220);
</script>

<Tooltip.Provider>
<main class={s.door} data-slop-selection="none" aria-busy={doc.isLoading} aria-label="Grocery list">
  <div class={`${s.magnet} ${s.banana}`} aria-hidden="true"><div class={s.bananaBody}><span></span><span></span></div></div>
  <div class={`${s.magnet} ${s.smiley}`} aria-hidden="true">😊</div>
  <div class={`${s.magnet} ${s.star}`} aria-hidden="true">★</div>

  <article class={s.notepad} inert={!doc.isReady || doc.isLoading}>
    <div class={s.titleRow}>
      <input class={s.title} aria-label="List title" bind:value={doc.current.title} placeholder="Groceries" />
      <span class={s.count}>{doneCount}/{totalCount} done</span>
    </div>

    <Tabs.Root value={filter} onValueChange={value => { if (value === "All" || isCategory(value)) filter = value; }}>
      <Tabs.List class={s.tabs} aria-label="Aisle filters" data-slop-export="hide">
        <Tabs.Trigger value="All" class={s.tab}>All</Tabs.Trigger>
        {#each CATEGORIES as category}
          <Tabs.Trigger value={category} class={s.tab}>{category}</Tabs.Trigger>
        {/each}
      </Tabs.List>
    </Tabs.Root>

    <form class={s.composer} data-slop-export="hide" onsubmit={event => { event.preventDefault(); addItem(); }}>
      <input bind:this={composer} bind:value={draft} aria-label="New grocery item" placeholder="Add milk, bread…" disabled={doc.isLoading} />
      <Select.Root type="single" value={aisle} items={categoryItems} onValueChange={value => { if (isCategory(value)) aisle = value; }}>
        <Select.Trigger class={s.selectTrigger} aria-label="Aisle for new item">
          <Select.Value placeholder="Aisle" />
          <ChevronDown size={12} strokeWidth={2.2} data-slop-export="hide" />
        </Select.Trigger>
        <Select.Portal>
          <Select.Content class={s.selectContent} sideOffset={6}>
            <Select.Viewport>
              {#each categoryItems as item (item.value)}
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
      <Button.Root class={s.add} type="submit" aria-label="Add item" disabled={!draft.trim() || doc.isLoading}><Plus size={16} /></Button.Root>
    </form>

    <ul class={s.list}>
      {#each visible as item (item.id)}
        <li class={s.row} data-done={item.done} animate:flip={{ duration: flipMs }}>
          <Checkbox.Root checked={item.done} onCheckedChange={checked => item.done = checked === true} aria-label={`Mark ${item.text || "untitled item"} ${item.done ? "still needed" : "in the cart"}`}>
            {#snippet children({ checked })}{#if checked}<Check size={12} strokeWidth={3} />{/if}{/snippet}
          </Checkbox.Root>
          <input class={s.itemText} aria-label="Grocery item text" bind:value={item.text} />
          <span class={s.badge}>{item.category}</span>
          <Tooltip.Root>
            <Tooltip.Trigger class={s.remove} data-slop-export="hide" aria-label={`Delete ${item.text || "untitled item"}`} onclick={() => removeItem(item.id)}><Trash2 size={13} /></Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Content class={s.tooltip} sideOffset={6}>Remove from the pad</Tooltip.Content>
            </Tooltip.Portal>
          </Tooltip.Root>
        </li>
      {:else}
        <li class={s.empty}>
          <h2>{filter === "All" ? "The pad is empty." : `Nothing in ${filter} yet.`}</h2>
          <p>{filter === "All" ? "Add milk, bread, or whatever you need." : "Add an item to this aisle, or switch back to All."}</p>
        </li>
      {/each}
    </ul>

    <div class={s.foot} data-slop-export="hide">
      <span>Enter to add. Check when it’s in the cart.</span>
      <Button.Root onclick={clearDone} disabled={!doneCount}>Clear checked{doneCount ? ` (${doneCount})` : ""}</Button.Root>
    </div>
  </article>

  <aside class={s.sticky}>
    <span class={s.pin} aria-hidden="true"></span>
    <textarea class={s.memo} aria-label="Sticky reminder" bind:value={doc.current.stickyNote} placeholder="A little reminder…"></textarea>
  </aside>

  {#if doc.error}
    <div class={s.error} role="alert">
      <span>{doc.isReady ? "Changes haven’t been saved." : "Your list couldn’t be loaded."} {doc.error}</span>
      <button data-slop-export="hide" onclick={() => { if (doc.isReady) void doc.flush().catch(() => undefined); else void doc.reload(); }}>Try again</button>
    </div>
  {:else if doc.isLoading}<p class={s.error} role="status">Loading your list…</p>{/if}
</main>

<IconTarget><Icon completed={doneCount} total={totalCount} /></IconTarget>
<ExportTarget><Export list={doc.current} filter={filter} /></ExportTarget>
</Tooltip.Provider>
