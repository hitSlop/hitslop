<script lang="ts">
  import { capture } from "@hitslop/runtime";
  import { jsonStore } from "@hitslop/svelte";
  import Plus from "@lucide/svelte/icons/plus";
  import Trash2 from "@lucide/svelte/icons/trash-2";
  import Icon from "./Icon.svelte";

  type ExpenseCategory = "food" | "transit" | "coffee" | "gear" | "bills" | "other";

  type ExpenseItem = {
    id: string;
    title: string;
    amount: number;
    category: ExpenseCategory;
    date: string;
    time: string;
  };

  type ExpenseLogState = {
    storeName: string;
    terminalId: string;
    currency: string;
    items: ExpenseItem[];
  };

  const CATEGORIES: Array<{ id: ExpenseCategory; label: string; code: string }> = [
    { id: "food", label: "Food", code: "FOOD" },
    { id: "transit", label: "Transit", code: "TRANSIT" },
    { id: "coffee", label: "Coffee", code: "COFFEE" },
    { id: "gear", label: "Gear", code: "GEAR" },
    { id: "bills", label: "Bills", code: "BILLS" },
    { id: "other", label: "Other", code: "MISC" },
  ];

  function formatTime(d: Date): string {
    return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
  }

  function formatDate(d: Date): string {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function categoryCode(id: ExpenseCategory): string {
    return CATEGORIES.find((cat) => cat.id === id)?.code ?? "MISC";
  }

  const now = new Date();
  const today = formatDate(now);
  const store = jsonStore<ExpenseLogState>({
    storeName: "DAILY EXPENSE LOG",
    terminalId: "#0842",
    currency: "$",
    items: [
      { id: "e-1", title: "Pour-over coffee", amount: 5.5, category: "coffee", date: today, time: "08:15" },
      { id: "e-2", title: "Subway pass", amount: 2.9, category: "transit", date: today, time: "08:45" },
      { id: "e-3", title: "Sourdough sandwich", amount: 14.25, category: "food", date: today, time: "12:30" },
      { id: "e-4", title: "Notebook & fine pen", amount: 18, category: "gear", date: today, time: "15:10" },
      { id: "e-5", title: "Cloud storage", amount: 9.99, category: "bills", date: today, time: "17:00" },
    ],
  });

  let draftTitle = $state("");
  let draftAmount = $state("");
  let draftCategory = $state<ExpenseCategory>("food");
  let titleRef = $state<HTMLInputElement>();

  const total = $derived(store.current.items.reduce((sum, item) => sum + Number(item.amount || 0), 0));
  const categoryTotals = $derived.by(() => {
    const map = new Map<ExpenseCategory, number>();
    for (const item of store.current.items) {
      map.set(item.category, (map.get(item.category) ?? 0) + Number(item.amount || 0));
    }
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  });

  function addItem(): void {
    const title = draftTitle.trim();
    const amountNum = parseFloat(draftAmount);
    if (!title || Number.isNaN(amountNum) || amountNum <= 0) return;
    const currentTime = new Date();
    store.current.items.push({
      id: crypto.randomUUID(),
      title,
      amount: Math.round(amountNum * 100) / 100,
      category: draftCategory,
      date: formatDate(currentTime),
      time: formatTime(currentTime),
    });
    draftTitle = "";
    draftAmount = "";
    requestAnimationFrame(() => titleRef?.focus());
  }

  function removeItem(id: string): void {
    store.current.items = store.current.items.filter((item) => item.id !== id);
  }

  function formatMoney(amount: number): string {
    const symbol = store.current.currency.trim() || "$";
    return `${symbol}${amount.toFixed(2)}`;
  }

  function clampCurrency(value: string): string {
    const next = value.replace(/\s/g, "").slice(0, 3);
    return next.length > 0 ? next : "$";
  }
</script>

<main class="receipt-shell" data-slop-selection="none">
  <div class="tear-edge" aria-hidden="true">
    <i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i>
  </div>

  <article class="receipt-paper">
    <header class="receipt-masthead">
      <p class="header-stamp">*** RECEIPT ***</p>
      <input class="receipt-store-title" bind:value={store.current.storeName} aria-label="Store title" />
      <div class="receipt-meta">
        <label class="terminal-field">
          <span>TERM</span>
          <input bind:value={store.current.terminalId} aria-label="Terminal id" />
        </label>
        <span>DATE {today}</span>
      </div>
    </header>

    <form class="composer-strip" data-slop-export="hide" onsubmit={(event) => { event.preventDefault(); addItem(); }}>
      <div class="composer-inputs">
        <input
          bind:this={titleRef}
          bind:value={draftTitle}
          class="title-input"
          placeholder="Item"
          aria-label="Item title"
          required
        />
        <div class="amount-wrap">
          <input
            class="currency-prefix"
            value={store.current.currency}
            oninput={(event) => { store.current.currency = clampCurrency(event.currentTarget.value); }}
            aria-label="Currency symbol"
            maxlength="3"
          />
          <input
            bind:value={draftAmount}
            class="amount-input"
            type="number"
            step="0.01"
            min="0.01"
            placeholder="0.00"
            aria-label="Amount"
            required
          />
        </div>
      </div>
      <div class="composer-bottom">
        <div class="category-pills" role="radiogroup" aria-label="Purchase category">
          {#each CATEGORIES as cat}
            <button
              type="button"
              class="cat-pill"
              class:selected={draftCategory === cat.id}
              onclick={() => { draftCategory = cat.id; }}
              role="radio"
              aria-checked={draftCategory === cat.id}
            >
              {cat.code}
            </button>
          {/each}
        </div>
        <button type="submit" class="add-btn" aria-label="Add purchase">
          <Plus size={16} />
        </button>
      </div>
    </form>

    <section class="items-table" aria-label="Recorded expenses">
      <div class="table-head">
        <span>ITEM</span>
        <span>AMT</span>
      </div>
      <ul class="items-list">
        {#each store.current.items as item (item.id)}
          <li class="item-row">
            <div class="item-info">
              <input class="item-title" bind:value={item.title} aria-label="Item description" />
              <span class="item-tag">{categoryCode(item.category)} · {item.time}</span>
            </div>
            <div class="item-right">
              <strong class="item-cost">{formatMoney(item.amount)}</strong>
              <button
                type="button"
                class="del-btn"
                data-slop-export="hide"
                onclick={() => removeItem(item.id)}
                aria-label={`Remove ${item.title}`}
              >
                <Trash2 size={13} />
              </button>
            </div>
          </li>
        {/each}
      </ul>
      {#if store.current.items.length === 0}
        <div class="empty-notice">
          <strong>NO TRANSACTIONS</strong>
          <p>Add a purchase above to start the roll.</p>
        </div>
      {/if}
    </section>

    <footer class="receipt-footer">
      {#if categoryTotals.length > 0}
        <div class="category-breakdown">
          <p class="breakdown-title">CATEGORY TOTALS</p>
          {#each categoryTotals as [cat, catSum]}
            <div class="breakdown-row">
              <span>{categoryCode(cat)}</span>
              <span>{formatMoney(catSum)}</span>
            </div>
          {/each}
        </div>
      {/if}

      <div class="grand-total-row">
        <span>TOTAL · {store.current.items.length}</span>
        <strong class="total-digits">{formatMoney(total)}</strong>
      </div>

      <div class="barcode-footer" aria-hidden="true">
        <div class="barcode-lines">
          <i></i><i class="w"></i><i></i><i class="w"></i><i></i><i></i><i class="w"></i><i></i>
          <i class="w"></i><i></i><i></i><i class="w"></i><i></i><i class="w"></i><i></i><i></i>
          <i></i><i class="w"></i><i></i><i></i><i class="w"></i><i></i><i class="w"></i><i></i>
        </div>
        <span class="barcode-digits">{today.replaceAll("-", "")}-{String(Math.round(total * 100)).padStart(6, "0")}</span>
        <span class="receipt-bye">THANK YOU FOR LOGGING</span>
      </div>
    </footer>
  </article>

  <div class="tear-edge bottom" aria-hidden="true">
    <i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i>
  </div>
</main>

{#if store.error}
  <p class="store-error">The receipt could not be saved.</p>
{/if}

{#if capture.isRenderer()}
  <Icon />
{/if}
