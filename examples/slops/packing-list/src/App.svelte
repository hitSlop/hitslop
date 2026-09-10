<script lang="ts">
  import { ready } from "@hitslop/runtime";
  import { jsonStore, IconTarget, ExportTarget } from "@hitslop/svelte";
  import { onDestroy } from "svelte";
  import { prefersReducedMotion } from "svelte/motion";
  import { flip } from "svelte/animate";
  import { Tabs, Checkbox, Select, Button, Tooltip, Dialog, Progress, Popover } from "bits-ui";
  import Plus from "@lucide/svelte/icons/plus";
  import Trash2 from "@lucide/svelte/icons/trash-2";
  import Check from "@lucide/svelte/icons/check";
  import ChevronDown from "@lucide/svelte/icons/chevron-down";
  import Sparkles from "@lucide/svelte/icons/sparkles";
  import X from "@lucide/svelte/icons/x";
  import packingSchema from "../schema";
  import type { PackingList } from "../schema";
  import { DEFAULT_CATEGORIES, PRESETS, type Preset } from "./presets";
  import Icon from "./Icon.svelte";
  import Export from "./Export.svelte";
  import * as s from "./styles.css";

  type Item = PackingList["items"][number];
  type Category = PackingList["categories"][number];

  const QTY_ITEMS = [1, 2, 3, 4, 5, 6, 7, 8, 9].map(value => ({ value: String(value), label: `×${value}` }));
  const POPULAR_FLAGS = [
    "🇯🇵", "🇫🇷", "🇮🇹", "🇪🇸", "🇬🇧", "🇺🇸", "🇩🇪", "🇨🇦",
    "🇲🇽", "🇨🇭", "🇬🇷", "🇵🇹", "🇳🇱", "🇹🇭", "🇰🇷", "🇦🇺",
    "🇳🇿", "🇮🇸", "🇳🇴", "🇸🇪", "🇧🇷", "🇦🇷", "🇮🇩", "🇻🇳",
    "🇸🇬", "🇲🇾", "🇿🇦", "🇪🇬", "🇲🇦", "🇹🇷", "🇮🇪", "🇦🇹",
    "✈️", "🌴", "🏔️", "🎒",
  ];

  const doc = jsonStore({ schema: packingSchema, initial: {
    tripTitle: "TOKYO & KYOTO AUTUMN",
    destination: "HND / TOKYO",
    departureDate: "2026-10-14",
    traveler: "JORDAN / TRAVELER",
    bagTag: "HS-9402",
    flag: "🇯🇵",
    categories: DEFAULT_CATEGORIES,
    items: [
      { id: "1", categoryId: "docs", text: "Passport & International Driver Permit", quantity: 1, packed: true, essential: true },
      { id: "2", categoryId: "docs", text: "JR Rail Pass Exchange Order", quantity: 1, packed: true, essential: true },
      { id: "3", categoryId: "docs", text: "Credit Cards with No Foreign Fee", quantity: 2, packed: true, essential: true },
      { id: "4", categoryId: "carry", text: "Noise-Canceling Headphones", quantity: 1, packed: true, essential: true },
      { id: "5", categoryId: "carry", text: "Travel Neck Pillow & Eye Mask", quantity: 1, packed: true, essential: false },
      { id: "6", categoryId: "carry", text: "Empty Collapsible Water Bottle", quantity: 1, packed: false, essential: false },
      { id: "7", categoryId: "carry", text: "Emergency Cash (Yen)", quantity: 1, packed: true, essential: true },
      { id: "8", categoryId: "tech", text: "Universal Plug Adapter (Japan Type A)", quantity: 2, packed: true, essential: true },
      { id: "9", categoryId: "tech", text: "High-Capacity Power Bank (20,000mAh)", quantity: 1, packed: true, essential: true },
      { id: "10", categoryId: "tech", text: "Laptop & USB-C Fast Charger", quantity: 1, packed: false, essential: true },
      { id: "11", categoryId: "tech", text: "Camera & Extra Memory Cards", quantity: 1, packed: false, essential: false },
      { id: "12", categoryId: "toiletries", text: "TSA Quart Clear Liquids Bag", quantity: 1, packed: true, essential: true },
      { id: "13", categoryId: "toiletries", text: "Prescription Meds & Ibuprofen", quantity: 1, packed: true, essential: true },
      { id: "14", categoryId: "toiletries", text: "Sunscreen & Moisturizer", quantity: 1, packed: false, essential: false },
      { id: "15", categoryId: "clothing", text: "Walking Sneakers (Break-in Tested)", quantity: 1, packed: true, essential: true },
      { id: "16", categoryId: "clothing", text: "Light Packable Rain Shell", quantity: 1, packed: false, essential: true },
      { id: "17", categoryId: "clothing", text: "Merino Wool Tops & Underwear", quantity: 4, packed: false, essential: true },
      { id: "18", categoryId: "gear", text: "Compact Travel Umbrella", quantity: 1, packed: false, essential: false },
      { id: "19", categoryId: "gear", text: "Coin Pouch for Vending Machines", quantity: 1, packed: true, essential: false },
    ],
  } });

  let filter = $state("all");
  let draft = $state("");
  let aisle = $state("carry");
  let qty = $state("1");
  let composer = $state<HTMLInputElement>();
  let presetsOpen = $state(false);
  let flagOpen = $state(false);
  let customFlag = $state("");
  $effect(() => { if (doc.isReady) ready(); });
  onDestroy(() => doc.destroy());

  const categoryItems = $derived(doc.current.categories.map(category => ({ value: category.id, label: category.name })));
  const totalCount = $derived(doc.current.items.length);
  const packedCount = $derived(doc.current.items.filter(item => item.packed).length);
  const packedPercent = $derived(totalCount > 0 ? Math.round((packedCount / totalCount) * 100) : 0);
  const fullyPacked = $derived(totalCount > 0 && packedCount === totalCount);
  const remainingCount = $derived(totalCount - packedCount);
  const visibleCategories = $derived(
    filter === "all" || filter === "remaining"
      ? doc.current.categories
      : doc.current.categories.filter(category => category.id === filter),
  );
  const flipMs = $derived(prefersReducedMotion.current ? 0 : 220);

  function isCategory(value: string): boolean {
    return doc.current.categories.some(category => category.id === value);
  }
  function isFilter(value: string): boolean {
    return value === "all" || value === "remaining" || isCategory(value);
  }
  function isQty(value: string): boolean {
    return QTY_ITEMS.some(item => item.value === value);
  }
  function countsFor(categoryId: string): { packed: number; total: number } {
    const items = doc.current.items.filter(item => item.categoryId === categoryId);
    return { total: items.length, packed: items.filter(item => item.packed).length };
  }
  function itemsFor(categoryId: string): Item[] {
    return doc.current.items.filter(item => {
      if (item.categoryId !== categoryId) return false;
      if (filter === "remaining") return !item.packed;
      return true;
    });
  }
  function addItem() {
    const text = draft.trim();
    if (!text || doc.isLoading) return;
    doc.current.items.push({
      id: crypto.randomUUID(),
      categoryId: aisle,
      text,
      quantity: Number(qty),
      packed: false,
      essential: false,
    });
    draft = "";
    composer?.focus();
  }
  function removeItem(id: string) {
    doc.current.items = doc.current.items.filter(item => item.id !== id);
  }
  function cycleQty(item: Item) {
    item.quantity = item.quantity >= 9 ? 1 : item.quantity + 1;
  }
  function packAll() {
    for (const item of doc.current.items) item.packed = true;
  }
  function unpackAll() {
    for (const item of doc.current.items) item.packed = false;
  }
  function clearPacked() {
    doc.current.items = doc.current.items.filter(item => !item.packed);
  }
  function applyPreset(preset: Preset) {
    for (const next of preset.items) {
      const exists = doc.current.items.some(item => item.text.toLowerCase() === next.text.toLowerCase());
      if (exists) continue;
      doc.current.items.push({
        id: crypto.randomUUID(),
        categoryId: next.categoryId,
        text: next.text,
        quantity: next.quantity,
        packed: false,
        essential: Boolean(next.essential),
      });
    }
    presetsOpen = false;
  }
  function selectFlag(flag: string) {
    doc.current.flag = flag;
    flagOpen = false;
  }
  function applyCustomFlag() {
    const trimmed = customFlag.trim();
    if (!trimmed) return;
    doc.current.flag = trimmed;
    customFlag = "";
    flagOpen = false;
  }
  function stampFor(category: Category): string {
    return category.color || "slate";
  }
  function emptyCopy(): { title: string; body: string } {
    if (totalCount === 0) return { title: "The tag is empty.", body: "Add a passport, charger, or whatever this trip needs." };
    if (filter === "remaining") return { title: "Everything is packed.", body: "Reset the tag for the next trip, or archive packed items." };
    const category = doc.current.categories.find(item => item.id === filter);
    return { title: `Nothing in ${category?.name ?? "this bag"} yet.`, body: "Add an item to this category, or switch back to All." };
  }
</script>

<Tooltip.Provider>
<main class={s.tag} data-slop-selection="none" aria-busy={doc.isLoading} aria-label="Packing list">
  <div class={s.airmail} aria-hidden="true"></div>

  <header class={s.header}>
    <div class={s.eyeletRow}>
      <Popover.Root bind:open={flagOpen}>
        <Popover.Trigger class={s.flagBtn} aria-label="Change destination flag (current: {doc.current.flag || '🇯🇵'})" disabled={doc.isLoading}>
          <span class={s.flagEmoji}>{doc.current.flag || "🇯🇵"}</span>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content class={s.flagPopover} sideOffset={8} data-slop-export="hide">
            <div class={s.flagHead}>
              <span>DESTINATION FLAG</span>
              <Popover.Close class={s.flagClose} aria-label="Close flag picker">✕</Popover.Close>
            </div>
            <div class={s.flagGrid}>
              {#each POPULAR_FLAGS as flag}
                <Popover.Close class={s.flagOpt} data-selected={doc.current.flag === flag} aria-label="Select flag {flag}" onclick={() => selectFlag(flag)}>{flag}</Popover.Close>
              {/each}
            </div>
            <form class={s.customFlag} onsubmit={event => { event.preventDefault(); applyCustomFlag(); }}>
              <input class={s.customFlagInput} placeholder="Paste emoji / flag..." aria-label="Custom flag or emoji" bind:value={customFlag} />
              <Button.Root class={s.applyFlag} type="submit">Set</Button.Root>
            </form>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>

      <span class={s.airline}>HS-BAG // TRAVEL MANIFEST</span>
      <Button.Root class={s.pill} data-slop-export="hide" onclick={() => (presetsOpen = true)} disabled={doc.isLoading}>
        <Sparkles size={11} />
        Presets
      </Button.Root>
    </div>

    <div class={s.meta}>
      <div class={s.field}>
        <label for="trip-title-input" class={s.metaLabel}>TRIP / EXPEDITION</label>
        <input id="trip-title-input" class={`${s.metaInput} ${s.titleInput}`} aria-label="Trip expedition title" bind:value={doc.current.tripTitle} />
      </div>
      <div class={s.submeta}>
        <div class={s.field}>
          <label for="dest-code-input" class={s.metaLabel}>DESTINATION</label>
          <input id="dest-code-input" class={`${s.metaInput} ${s.destInput}`} aria-label="Destination code" bind:value={doc.current.destination} />
        </div>
        <div class={s.field}>
          <label for="traveler-input" class={s.metaLabel}>PASSENGER</label>
          <input id="traveler-input" class={`${s.metaInput} ${s.passengerInput}`} aria-label="Passenger name" bind:value={doc.current.traveler} />
        </div>
        <div class={`${s.field} ${s.dateField}`}>
          <label for="date-input" class={s.metaLabel}>DEPARTURE</label>
          <input id="date-input" type="date" class={`${s.metaInput} ${s.dateInput}`} aria-label="Departure date" bind:value={doc.current.departureDate} />
        </div>
      </div>
    </div>
  </header>

  <section class={s.readiness}>
    <div class={s.readinessRow}>
      <div class={s.readinessStatus}>
        <span>BAGGAGE STATUS:</span>
        <span class={s.readyBadge} data-complete={fullyPacked}>{packedCount} / {totalCount} PACKED ({packedPercent}%)</span>
      </div>
      <div class={s.quickActions} data-slop-export="hide">
        <Button.Root class={s.pill} onclick={packAll} disabled={!remainingCount || doc.isLoading}>Pack All</Button.Root>
        <Button.Root class={s.pill} onclick={unpackAll} disabled={!packedCount || doc.isLoading}>Reset</Button.Root>
        <Button.Root class={s.pill} onclick={clearPacked} disabled={!packedCount || doc.isLoading}>Archive packed{packedCount ? ` (${packedCount})` : ""}</Button.Root>
      </div>
    </div>
    <Progress.Root class={s.track} value={packedCount} max={totalCount || 1} aria-label="Packing readiness">
      <div class={s.fill} data-complete={fullyPacked} style:width="{packedPercent}%"></div>
    </Progress.Root>
  </section>

  <Tabs.Root value={filter} onValueChange={value => { if (isFilter(value)) filter = value; }}>
    <Tabs.List class={s.tabs} aria-label="Category filters" data-slop-export="hide">
      <Tabs.Trigger value="all" class={s.tab}>All <span class={s.pillCount}>({totalCount})</span></Tabs.Trigger>
      <Tabs.Trigger value="remaining" class={s.tab}>Remaining <span class={s.pillCount}>({remainingCount})</span></Tabs.Trigger>
      {#each doc.current.categories as category}
        {@const counts = countsFor(category.id)}
        <Tabs.Trigger value={category.id} class={s.tab}>{category.tagCode} <span class={s.pillCount}>({counts.packed}/{counts.total})</span></Tabs.Trigger>
      {/each}
    </Tabs.List>
  </Tabs.Root>

  <form class={s.composer} data-slop-export="hide" onsubmit={event => { event.preventDefault(); addItem(); }}>
    <input bind:this={composer} class={s.addInput} bind:value={draft} aria-label="New packing item" placeholder="Add passport, charger…" disabled={doc.isLoading} />
    <Select.Root type="single" value={qty} items={QTY_ITEMS} onValueChange={value => { if (isQty(value)) qty = value; }}>
      <Select.Trigger class={s.selectTrigger} aria-label="Item quantity">
        <Select.Value placeholder="×1" />
        <ChevronDown size={12} strokeWidth={2.2} data-slop-export="hide" />
      </Select.Trigger>
      <Select.Portal>
        <Select.Content class={s.selectContent} sideOffset={6}>
          <Select.Viewport>
            {#each QTY_ITEMS as item (item.value)}
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
    <Select.Root type="single" value={aisle} items={categoryItems} onValueChange={value => { if (isCategory(value)) aisle = value; }}>
      <Select.Trigger class={s.selectTrigger} aria-label="Bag category for new item">
        <Select.Value placeholder="Category" />
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
    <Button.Root class={s.add} type="submit" aria-label="Add item" disabled={!draft.trim() || doc.isLoading}><Plus size={14} /><span>Add</span></Button.Root>
  </form>

  <div class={s.checklist} inert={!doc.isReady || doc.isLoading}>
    {#each visibleCategories as category (category.id)}
      {@const items = itemsFor(category.id)}
      {@const counts = countsFor(category.id)}
      {#if items.length > 0}
        <section class={s.block} aria-label={category.name}>
          <div class={s.blockHead}>
            <span class={s.stamp} data-stamp={stampFor(category)}>{category.tagCode} // {category.name}</span>
            <span class={s.blockCount}>{counts.packed} of {counts.total} packed</span>
          </div>
          <ul class={s.list}>
            {#each items as item (item.id)}
              <li class={s.row} data-packed={item.packed} animate:flip={{ duration: flipMs }}>
                <Checkbox.Root checked={item.packed} onCheckedChange={checked => item.packed = checked === true} aria-label="Toggle packed status for {item.text}">
                  {#snippet children({ checked })}{#if checked}<span class={s.checkIcon}>✓</span>{/if}{/snippet}
                </Checkbox.Root>
                <button type="button" class={s.qty} title="Click to cycle quantity" onclick={() => cycleQty(item)}>×{item.quantity}</button>
                <input class={s.itemText} aria-label="Item description" bind:value={item.text} />
                <button type="button" class={s.star} data-active={item.essential} title="Toggle essential item" onclick={() => item.essential = !item.essential}>{item.essential ? "★" : "☆"}</button>
                <Tooltip.Root>
                  <Tooltip.Trigger class={s.remove} data-slop-export="hide" aria-label="Delete {item.text || 'untitled item'}" onclick={() => removeItem(item.id)}><Trash2 size={13} /></Tooltip.Trigger>
                  <Tooltip.Portal>
                    <Tooltip.Content class={s.tooltip} sideOffset={6}>Remove from the tag</Tooltip.Content>
                  </Tooltip.Portal>
                </Tooltip.Root>
              </li>
            {/each}
          </ul>
        </section>
      {/if}
    {/each}

    {#if visibleCategories.every(category => itemsFor(category.id).length === 0)}
      {@const copy = emptyCopy()}
      <div class={s.empty}>
        <h2>{copy.title}</h2>
        <p>{copy.body}</p>
      </div>
    {/if}
  </div>

  <footer class={s.footer}>
    <div class={s.barcodeBlock}>
      <div class={s.barcode} aria-hidden="true"></div>
      <span class={s.barcodeCode}>{doc.current.bagTag} // CHECKED AIRLINE TAG</span>
    </div>
    <div class={s.footerStamp} data-complete={fullyPacked}>{fullyPacked ? "100% READY FOR FLIGHT" : "PACK IN PROGRESS"}</div>
  </footer>

  {#if doc.error}
    <div class={s.error} role="alert">
      <span>{doc.isReady ? "Changes haven’t been saved." : "Your list couldn’t be loaded."} {doc.error}</span>
      <button data-slop-export="hide" onclick={() => { if (doc.isReady) void doc.flush().catch(() => undefined); else void doc.reload(); }}>Try again</button>
    </div>
  {:else if doc.isLoading}<p class={s.error} role="status">Loading your list…</p>{/if}

  <Dialog.Root bind:open={presetsOpen}>
    <Dialog.Portal>
      <Dialog.Overlay class={s.overlay} data-slop-export="hide" />
      <Dialog.Content class={s.presetsCard} aria-labelledby="preset-modal-title" data-slop-export="hide">
        <div class={s.presetsHead}>
          <Dialog.Title id="preset-modal-title">TRAVEL PACKING PRESETS</Dialog.Title>
          <Dialog.Close class={s.pill} aria-label="Close presets"><X size={14} /></Dialog.Close>
        </div>
        <div class={s.presetList}>
          {#each PRESETS as preset}
            <button type="button" class={s.presetItem} onclick={() => applyPreset(preset)}>
              <span class={s.presetInfo}>
                <span class={s.presetName}>{preset.name}</span>
                <span class={s.presetDesc}>{preset.description} ({preset.items.length} essentials)</span>
              </span>
              <span class={s.presetAdd}>+ Add Items</span>
            </button>
          {/each}
        </div>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>
</main>

<IconTarget><Icon packed={packedCount} total={totalCount} /></IconTarget>
<ExportTarget><Export list={doc.current} filter={filter} /></ExportTarget>
</Tooltip.Provider>
