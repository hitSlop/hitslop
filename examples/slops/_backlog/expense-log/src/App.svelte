<script lang="ts">
  import { ready } from "@hitslop/runtime";
  import { jsonStore, IconTarget, ExportTarget } from "@hitslop/svelte";
  import { onDestroy } from "svelte";
  import { prefersReducedMotion } from "svelte/motion";
  import { flip } from "svelte/animate";
  import { RadioGroup, Button, Tooltip } from "bits-ui";
  import Plus from "@lucide/svelte/icons/plus";
  import Trash2 from "@lucide/svelte/icons/trash-2";
  import expenseSchema from "../schema";
  import Icon from "./Icon.svelte";
  import Export from "./Export.svelte";
  import * as s from "./styles.css";

  const CATEGORIES = [
    { id: "food", label: "Food", code: "FOOD" },
    { id: "transit", label: "Transit", code: "TRANSIT" },
    { id: "coffee", label: "Coffee", code: "COFFEE" },
    { id: "gear", label: "Gear", code: "GEAR" },
    { id: "bills", label: "Bills", code: "BILLS" },
    { id: "other", label: "Other", code: "MISC" },
  ] as const;
  type ExpenseCategory = typeof CATEGORIES[number]["id"];

  function formatTime(d: Date): string {
    return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
  }
  function formatDate(d: Date): string {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  function isCategory(value: string): value is ExpenseCategory {
    return CATEGORIES.some(cat => cat.id === value);
  }
  function categoryCode(id: string): string {
    return CATEGORIES.find(cat => cat.id === id)?.code ?? "MISC";
  }

  const now = new Date();
  const today = formatDate(now);
  const doc = jsonStore({ schema: expenseSchema, initial: {
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
  } });

  let draftTitle = $state("");
  let draftAmount = $state("");
  let draftCategory = $state<ExpenseCategory>("food");
  let titleRef = $state<HTMLInputElement>();
  $effect(() => { if (doc.isReady) ready(); });
  onDestroy(() => doc.destroy());

  const total = $derived(doc.current.items.reduce((sum, item) => sum + Number(item.amount || 0), 0));
  const categoryTotals = $derived.by(() => {
    const map = new Map<string, number>();
    for (const item of doc.current.items) {
      map.set(item.category, (map.get(item.category) ?? 0) + Number(item.amount || 0));
    }
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  });
  const canAdd = $derived(Boolean(draftTitle.trim()) && Number(draftAmount) > 0 && !doc.isLoading);
  const flipMs = $derived(prefersReducedMotion.current ? 0 : 220);

  function addItem(): void {
    const title = draftTitle.trim();
    const amountNum = parseFloat(draftAmount);
    if (!title || Number.isNaN(amountNum) || amountNum <= 0 || doc.isLoading) return;
    const currentTime = new Date();
    doc.current.items.push({
      id: crypto.randomUUID(),
      title,
      amount: Math.round(amountNum * 100) / 100,
      category: draftCategory,
      date: formatDate(currentTime),
      time: formatTime(currentTime),
    });
    draftTitle = "";
    draftAmount = "";
    titleRef?.focus();
  }
  function removeItem(id: string): void {
    doc.current.items = doc.current.items.filter(item => item.id !== id);
  }
  function formatMoney(amount: number): string {
    const symbol = doc.current.currency.trim() || "$";
    return `${symbol}${amount.toFixed(2)}`;
  }
  function clampCurrency(value: string): string {
    const next = value.replace(/\s/g, "").slice(0, 3);
    return next.length > 0 ? next : "$";
  }
</script>

<Tooltip.Provider>
<main class={s.shell} data-slop-selection="none" aria-busy={doc.isLoading} aria-label="Expense receipt">
  <div class={s.tear} aria-hidden="true">
    {#each Array.from({ length: 12 }) as _, index (index)}<i></i>{/each}
  </div>

  <article class={s.paper} inert={!doc.isReady || doc.isLoading}>
    <header class={s.masthead}>
      <p class={s.stamp}>*** RECEIPT ***</p>
      <input class={s.storeTitle} bind:value={doc.current.storeName} aria-label="Store title" />
      <div class={s.meta}>
        <label class={s.terminal}>
          <span>TERM</span>
          <input bind:value={doc.current.terminalId} aria-label="Terminal id" />
        </label>
        <span>DATE {today}</span>
      </div>
    </header>

    <form class={s.composer} data-slop-export="hide" onsubmit={event => { event.preventDefault(); addItem(); }}>
      <div class={s.composerInputs}>
        <input
          bind:this={titleRef}
          bind:value={draftTitle}
          class={s.titleInput}
          placeholder="Item"
          aria-label="Item title"
          required
          disabled={doc.isLoading}
        />
        <div class={s.amountWrap}>
          <input
            class={s.currency}
            value={doc.current.currency}
            oninput={event => { doc.current.currency = clampCurrency(event.currentTarget.value); }}
            aria-label="Currency symbol"
            maxlength="3"
            disabled={doc.isLoading}
          />
          <input
            bind:value={draftAmount}
            class={s.amountInput}
            type="number"
            step="0.01"
            min="0.01"
            placeholder="0.00"
            aria-label="Amount"
            required
            disabled={doc.isLoading}
          />
        </div>
      </div>
      <div class={s.composerBottom}>
        <RadioGroup.Root
          class={s.catGroup}
          orientation="horizontal"
          value={draftCategory}
          onValueChange={value => { if (isCategory(value)) draftCategory = value; }}
          aria-label="Purchase category"
        >
          {#each CATEGORIES as cat (cat.id)}
            <RadioGroup.Item value={cat.id} class={s.catPill} aria-label={cat.label}>{cat.code}</RadioGroup.Item>
          {/each}
        </RadioGroup.Root>
        <Button.Root class={s.add} type="submit" aria-label="Add purchase" disabled={!canAdd}><Plus size={16} /></Button.Root>
      </div>
    </form>

    <section class={s.items} aria-label="Recorded expenses">
      <div class={s.tableHead}>
        <span>ITEM</span>
        <span>AMT</span>
      </div>
      <ul class={s.list}>
        {#each doc.current.items as item (item.id)}
          <li class={s.row} animate:flip={{ duration: flipMs }}>
            <div class={s.itemInfo}>
              <input class={s.itemTitle} bind:value={item.title} aria-label="Item description" />
              <span class={s.itemTag}>{categoryCode(item.category)} · {item.time}</span>
            </div>
            <div class={s.itemRight}>
              <strong class={s.itemCost}>{formatMoney(item.amount)}</strong>
              <Tooltip.Root>
                <Tooltip.Trigger class={s.remove} data-slop-export="hide" aria-label={`Remove ${item.title || "untitled item"}`} onclick={() => removeItem(item.id)}><Trash2 size={13} /></Tooltip.Trigger>
                <Tooltip.Portal>
                  <Tooltip.Content class={s.tooltip} sideOffset={6}>VOID LINE</Tooltip.Content>
                </Tooltip.Portal>
              </Tooltip.Root>
            </div>
          </li>
        {:else}
          <li class={s.empty}>
            <strong>NO TRANSACTIONS</strong>
            <p>Add a purchase above to start the roll.</p>
          </li>
        {/each}
      </ul>
    </section>

    <footer class={s.footer}>
      {#if categoryTotals.length > 0}
        <div class={s.breakdown}>
          <p class={s.breakdownTitle}>CATEGORY TOTALS</p>
          {#each categoryTotals as [cat, catSum] (cat)}
            <div class={s.breakdownRow}>
              <span>{categoryCode(cat)}</span>
              <span>{formatMoney(catSum)}</span>
            </div>
          {/each}
        </div>
      {/if}

      <div class={s.grand} aria-live="polite">
        <span>TOTAL · {doc.current.items.length}</span>
        <strong class={s.totalDigits}>{formatMoney(total)}</strong>
      </div>

      <div class={s.barcodeBlock} aria-hidden="true">
        <div class={s.barcode}>
          <i></i><i data-wide="true"></i><i></i><i data-wide="true"></i><i></i><i></i><i data-wide="true"></i><i></i>
          <i data-wide="true"></i><i></i><i></i><i data-wide="true"></i><i></i><i data-wide="true"></i><i></i><i></i>
          <i></i><i data-wide="true"></i><i></i><i></i><i data-wide="true"></i><i></i><i data-wide="true"></i><i></i>
        </div>
        <span class={s.barcodeLabel}>{today.replaceAll("-", "")}-{String(Math.round(total * 100)).padStart(6, "0")}</span>
        <span class={s.barcodeLabel}>THANK YOU FOR LOGGING</span>
      </div>
    </footer>
  </article>

  <div class={s.tear} data-edge="bottom" aria-hidden="true">
    {#each Array.from({ length: 12 }) as _, index (index)}<i></i>{/each}
  </div>
</main>

{#if doc.error}
  <div class={s.error} role="alert">
    <span>{doc.isReady ? "The receipt could not be saved." : "The receipt could not be loaded."} {doc.error}</span>
    <button data-slop-export="hide" onclick={() => { if (doc.isReady) void doc.flush().catch(() => undefined); else void doc.reload(); }}>Try again</button>
  </div>
{:else if doc.isLoading}<p class={s.error} role="status">Loading the roll…</p>{/if}

<IconTarget><Icon data={doc.current} total={total} /></IconTarget>
<ExportTarget><Export data={doc.current} printedOn={today} /></ExportTarget>
</Tooltip.Provider>
