<script lang="ts">
  import { capture } from "@hitslop/runtime";
  import { jsonStore } from "@hitslop/svelte";
  import Plus from "@lucide/svelte/icons/plus";
  import Trash2 from "@lucide/svelte/icons/trash-2";
  import Sparkles from "@lucide/svelte/icons/sparkles";
  import X from "@lucide/svelte/icons/x";
  import Icon from "./Icon.svelte";
  import { DEFAULT_CATEGORIES, PRESETS, type Preset } from "./presets";
  import type { LuggageCategory, PackingDoc, PackingItem } from "./types";

  const doc = jsonStore<PackingDoc>({
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
  });

  let activeFilter = $state<string>("all");
  let newItemText = $state("");
  let newItemCategory = $state("carry");
  let newItemQty = $state(1);
  let showPresetsModal = $state(false);
  let showFlagPicker = $state(false);
  let customFlagInput = $state("");

  const POPULAR_FLAGS = [
    "🇯🇵", "🇫🇷", "🇮🇹", "🇪🇸", "🇬🇧", "🇺🇸", "🇩🇪", "🇨🇦",
    "🇲🇽", "🇨🇭", "🇬🇷", "🇵🇹", "🇳🇱", "🇹🇭", "🇰🇷", "🇦🇺",
    "🇳🇿", "🇮🇸", "🇳🇴", "🇸🇪", "🇧🇷", "🇦🇷", "🇮🇩", "🇻🇳",
    "🇸🇬", "🇲🇾", "🇿🇦", "🇪🇬", "🇲🇦", "🇹🇷", "🇮🇪", "🇦🇹",
    "✈️", "🌴", "🏔️", "🎒",
  ];

  function selectFlag(f: string) {
    doc.current.flag = f;
    showFlagPicker = false;
  }

  function applyCustomFlag() {
    const trimmed = customFlagInput.trim();
    if (trimmed) {
      doc.current.flag = trimmed;
      customFlagInput = "";
      showFlagPicker = false;
    }
  }

  // Normalize departure date to YYYY-MM-DD if in non-ISO format
  $effect(() => {
    if (doc.current.departureDate && !/^\d{4}-\d{2}-\d{2}$/.test(doc.current.departureDate)) {
      const parsed = new Date(doc.current.departureDate);
      if (!isNaN(parsed.getTime())) {
        doc.current.departureDate = parsed.toISOString().slice(0, 10);
      } else {
        doc.current.departureDate = "2026-10-14";
      }
    }
  });

  const totalItems = $derived(doc.current.items.length);
  const packedItems = $derived(doc.current.items.filter((i) => i.packed).length);
  const packedPercent = $derived(totalItems > 0 ? Math.round((packedItems / totalItems) * 100) : 0);
  const isFullyPacked = $derived(totalItems > 0 && packedItems === totalItems);

  const displayedCategories = $derived.by(() => {
    if (activeFilter === "all" || activeFilter === "remaining") {
      return doc.current.categories;
    }
    return doc.current.categories.filter((c) => c.id === activeFilter);
  });

  function getCategoryItems(categoryId: string): PackingItem[] {
    return doc.current.items.filter((item) => {
      if (item.categoryId !== categoryId) return false;
      if (activeFilter === "remaining") return !item.packed;
      return true;
    });
  }

  function getCategoryCounts(categoryId: string): { packed: number; total: number } {
    const items = doc.current.items.filter((i) => i.categoryId === categoryId);
    return {
      total: items.length,
      packed: items.filter((i) => i.packed).length,
    };
  }

  function togglePacked(item: PackingItem) {
    item.packed = !item.packed;
  }

  function toggleEssential(item: PackingItem) {
    item.essential = !item.essential;
  }

  function cycleQty(item: PackingItem) {
    item.quantity = item.quantity >= 9 ? 1 : item.quantity + 1;
  }

  function addItem() {
    const text = newItemText.trim();
    if (!text) return;
    doc.current.items.push({
      id: crypto.randomUUID(),
      categoryId: newItemCategory,
      text,
      quantity: newItemQty,
      packed: false,
      essential: false,
    });
    newItemText = "";
  }

  function removeItem(id: string) {
    doc.current.items = doc.current.items.filter((i) => i.id !== id);
  }

  function packAll() {
    for (const item of doc.current.items) {
      item.packed = true;
    }
  }

  function unpackAll() {
    for (const item of doc.current.items) {
      item.packed = false;
    }
  }

  function applyPreset(preset: Preset) {
    for (const pItem of preset.items) {
      // Avoid duplicate texts
      const exists = doc.current.items.some(
        (i) => i.text.toLowerCase() === pItem.text.toLowerCase()
      );
      if (!exists) {
        doc.current.items.push({
          id: crypto.randomUUID(),
          categoryId: pItem.categoryId,
          text: pItem.text,
          quantity: pItem.quantity,
          packed: false,
          essential: Boolean(pItem.essential),
        });
      }
    }
    showPresetsModal = false;
  }
</script>

<main class="luggage-tag">
  <!-- Top Airmail Chevron Stripe -->
  <div class="airmail-stripe" aria-hidden="true"></div>

  <!-- Tag Header & Flag Destination -->
  <header class="tag-header">
    <div class="eyelet-row">
      <div class="flag-picker-anchor">
        <button
          type="button"
          class="flag-stamp-btn"
          aria-label="Change destination flag (current: {doc.current.flag || '🇯🇵'})"
          title="Click to change destination flag"
          onclick={() => (showFlagPicker = !showFlagPicker)}
        >
          <span class="flag-emoji">{doc.current.flag || "🇯🇵"}</span>
        </button>

        {#if showFlagPicker}
          <div class="flag-popover" data-slop-export="hide">
            <div class="flag-popover-header">
              <span>DESTINATION FLAG</span>
              <button
                type="button"
                class="flag-close-btn"
                onclick={() => (showFlagPicker = false)}
                aria-label="Close flag picker"
              >
                ✕
              </button>
            </div>
            <div class="flag-grid">
              {#each POPULAR_FLAGS as flag}
                <button
                  type="button"
                  class="flag-opt-btn"
                  class:selected={doc.current.flag === flag}
                  onclick={() => selectFlag(flag)}
                  aria-label="Select flag {flag}"
                >
                  {flag}
                </button>
              {/each}
            </div>
            <div class="custom-flag-row">
              <input
                class="custom-flag-input"
                placeholder="Paste emoji / flag..."
                aria-label="Custom flag or emoji"
                bind:value={customFlagInput}
                onkeydown={(e) => { if (e.key === 'Enter') applyCustomFlag(); }}
              />
              <button
                type="button"
                class="apply-flag-btn"
                onclick={applyCustomFlag}
              >
                Set
              </button>
            </div>
          </div>
        {/if}
      </div>

      <span class="airline-badge">HS-BAG // TRAVEL MANIFEST</span>
      <button
        type="button"
        class="action-pill-btn"
        data-slop-export="hide"
        onclick={() => (showPresetsModal = true)}
      >
        <Sparkles size={11} style="display: inline; vertical-align: middle; margin-right: 3px;" />
        Presets
      </button>
    </div>

    <div class="tag-meta-block">
      <div class="meta-field title-field">
        <label for="trip-title-input" class="meta-label">TRIP / EXPEDITION</label>
        <input
          id="trip-title-input"
          class="meta-input title-input"
          aria-label="Trip expedition title"
          bind:value={doc.current.tripTitle}
        />
      </div>

      <div class="tag-submeta-row">
        <div class="meta-field dest-field">
          <label for="dest-code-input" class="meta-label">DESTINATION</label>
          <input
            id="dest-code-input"
            class="meta-input dest-input"
            aria-label="Destination code"
            bind:value={doc.current.destination}
          />
        </div>

        <div class="meta-field passenger-field">
          <label for="traveler-input" class="meta-label">PASSENGER</label>
          <input
            id="traveler-input"
            class="meta-input passenger-input"
            aria-label="Passenger name"
            bind:value={doc.current.traveler}
          />
        </div>

        <div class="meta-field date-field">
          <label for="date-input" class="meta-label">DEPARTURE</label>
          <input
            id="date-input"
            type="date"
            class="meta-input date-input"
            aria-label="Departure date"
            bind:value={doc.current.departureDate}
          />
        </div>
      </div>
    </div>
  </header>

  <!-- Baggage Readiness Meter -->
  <section class="readiness-strip">
    <div class="readiness-text-row">
      <div class="readiness-status">
        <span>BAGGAGE STATUS:</span>
        <span class="readiness-badge" class:complete={isFullyPacked}>
          {packedItems} / {totalItems} PACKED ({packedPercent}%)
        </span>
      </div>

      <div class="quick-actions" data-slop-export="hide">
        <button type="button" class="action-pill-btn" onclick={packAll}>
          Pack All
        </button>
        <button type="button" class="action-pill-btn" onclick={unpackAll}>
          Reset / Unpack
        </button>
      </div>
    </div>

    <div class="readiness-bar-track" aria-hidden="true">
      <div
        class="readiness-bar-fill"
        class:complete={isFullyPacked}
        style="width: {packedPercent}%;"
      ></div>
    </div>
  </section>

  <!-- Filter Toolbar -->
  <nav class="toolbar-row" data-slop-export="hide" aria-label="Category filters">
    <div class="filter-pills">
      <button
        type="button"
        class="filter-btn"
        class:active={activeFilter === "all"}
        onclick={() => (activeFilter = "all")}
      >
        All <span class="pill-count">({totalItems})</span>
      </button>
      <button
        type="button"
        class="filter-btn"
        class:active={activeFilter === "remaining"}
        onclick={() => (activeFilter = "remaining")}
      >
        Remaining <span class="pill-count">({totalItems - packedItems})</span>
      </button>
      {#each doc.current.categories as cat}
        {@const counts = getCategoryCounts(cat.id)}
        {#if counts.total > 0}
          <button
            type="button"
            class="filter-btn"
            class:active={activeFilter === cat.id}
            onclick={() => (activeFilter = cat.id)}
          >
            {cat.name} <span class="pill-count">({counts.packed}/{counts.total})</span>
          </button>
        {/if}
      {/each}
    </div>
  </nav>

  <!-- Quick Add Item Row -->
  <form
    class="quick-add-form"
    data-slop-export="hide"
    onsubmit={(e) => { e.preventDefault(); addItem(); }}
  >
    <input
      class="item-add-input"
      placeholder="Add luggage item (e.g. Passport, Charger)..."
      aria-label="Add packing item text"
      bind:value={newItemText}
    />
    <select
      class="qty-select"
      aria-label="Item quantity"
      bind:value={newItemQty}
    >
      {#each [1, 2, 3, 4, 5, 6, 7, 8, 9] as q}
        <option value={q}>×{q}</option>
      {/each}
    </select>
    <select
      class="cat-select"
      aria-label="Item category"
      bind:value={newItemCategory}
    >
      {#each doc.current.categories as cat}
        <option value={cat.id}>{cat.name}</option>
      {/each}
    </select>
    <button type="submit" class="add-btn" aria-label="Add item to list">
      <Plus size={14} />
      <span>Add</span>
    </button>
  </form>

  <!-- Checklist Content by Category -->
  <div class="checklist-content">
    {#each displayedCategories as cat}
      {@const items = getCategoryItems(cat.id)}
      {@const counts = getCategoryCounts(cat.id)}
      {#if items.length > 0}
        <section class="category-block" aria-label={cat.name}>
          <div class="category-header">
            <span class="stamp-badge {cat.color}">
              {cat.tagCode} // {cat.name}
            </span>
            <span class="category-count">
              {counts.packed} of {counts.total} packed
            </span>
          </div>

          <ul class="item-list">
            {#each items as item (item.id)}
              <li class="item-row" class:packed={item.packed}>
                <button
                  type="button"
                  class="custom-check"
                  aria-label="Toggle packed status for {item.text}"
                  onclick={() => togglePacked(item)}
                >
                  {#if item.packed}
                    <span class="check-icon">✓</span>
                  {/if}
                </button>

                <button
                  type="button"
                  class="qty-badge"
                  title="Click to cycle quantity"
                  onclick={() => cycleQty(item)}
                >
                  ×{item.quantity}
                </button>

                <input
                  class="item-name-input"
                  aria-label="Item description"
                  bind:value={item.text}
                />

                <button
                  type="button"
                  class="star-btn"
                  class:active={item.essential}
                  title="Toggle essential item"
                  onclick={() => toggleEssential(item)}
                >
                  {item.essential ? "★" : "☆"}
                </button>

                <button
                  type="button"
                  class="delete-btn"
                  data-slop-export="hide"
                  aria-label="Delete {item.text}"
                  onclick={() => removeItem(item.id)}
                >
                  <Trash2 size={13} />
                </button>
              </li>
            {/each}
          </ul>
        </section>
      {/if}
    {/each}
  </div>

  <!-- Tag Footer Barcode & Stamp -->
  <footer class="tag-footer">
    <div class="barcode-block">
      <div class="barcode" aria-hidden="true"></div>
      <span class="barcode-code">{doc.current.bagTag} // CHECKED AIRLINE TAG</span>
    </div>

    <div class="footer-stamp">
      {isFullyPacked ? "100% READY FOR FLIGHT" : "PACK IN PROGRESS"}
    </div>
  </footer>

  <!-- Presets Modal -->
  {#if showPresetsModal}
    <div class="presets-overlay" data-slop-export="hide">
      <div class="presets-card" role="dialog" aria-modal="true" aria-labelledby="preset-modal-title">
        <div class="presets-header">
          <h3 id="preset-modal-title">TRAVEL PACKING PRESETS</h3>
          <button
            type="button"
            class="action-pill-btn"
            aria-label="Close presets"
            onclick={() => (showPresetsModal = false)}
          >
            <X size={14} />
          </button>
        </div>

        <div class="preset-list">
          {#each PRESETS as preset}
            <div
              class="preset-item"
              role="button"
              tabindex="0"
              onclick={() => applyPreset(preset)}
              onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') applyPreset(preset); }}
            >
              <div class="preset-info">
                <span class="preset-name">{preset.name}</span>
                <span class="preset-desc">{preset.description} ({preset.items.length} essentials)</span>
              </div>
              <span class="preset-add-tag">+ Add Items</span>
            </div>
          {/each}
        </div>
      </div>
    </div>
  {/if}
</main>

{#if capture.isRenderer()}
  <Icon />
{/if}
