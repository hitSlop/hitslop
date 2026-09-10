<script lang="ts">
  import type { ExpenseLog } from "../schema";
  import * as s from "./styles.css";

  const CATEGORIES: Record<string, string> = {
    food: "FOOD",
    transit: "TRANSIT",
    coffee: "COFFEE",
    gear: "GEAR",
    bills: "BILLS",
    other: "MISC",
  };

  let { data, printedOn }: { data: ExpenseLog; printedOn: string } = $props();
  const total = $derived(data.items.reduce((sum, item) => sum + Number(item.amount || 0), 0));
  const categoryTotals = $derived.by(() => {
    const map = new Map<string, number>();
    for (const item of data.items) {
      map.set(item.category, (map.get(item.category) ?? 0) + Number(item.amount || 0));
    }
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  });
  const symbol = $derived(data.currency.trim() || "$");
  function money(amount: number): string {
    return `${symbol}${amount.toFixed(2)}`;
  }
  function code(id: string): string {
    return CATEGORIES[id] ?? "MISC";
  }
</script>

<article class={s.exportShell} aria-label="Exported expense receipt">
  <div class={s.tear} aria-hidden="true">
    {#each Array.from({ length: 12 }) as _, index (index)}<i></i>{/each}
  </div>

  <div class={s.paper}>
    <header class={s.masthead}>
      <p class={s.stamp}>*** RECEIPT ***</p>
      <h1 class={s.storeTitle}>{data.storeName.trim() || "EXPENSE LOG"}</h1>
      <div class={s.meta}>
        <span>TERM {data.terminalId.trim() || "—"}</span>
        <span>DATE {printedOn}</span>
      </div>
    </header>

    <section class={s.items} aria-label="Recorded expenses">
      <div class={s.tableHead}>
        <span>ITEM</span>
        <span>AMT</span>
      </div>
      <ul class={s.list}>
        {#each data.items as item (item.id)}
          <li class={s.row}>
            <div class={s.itemInfo}>
              <span class={s.itemTitle}>{item.title.trim() || "Untitled item"}</span>
              <span class={s.itemTag}>{code(item.category)} · {item.time}</span>
            </div>
            <strong class={s.itemCost}>{money(item.amount)}</strong>
          </li>
        {:else}
          <li class={s.empty}>
            <strong>NO TRANSACTIONS</strong>
            <p>Nothing printed on this roll.</p>
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
              <span>{code(cat)}</span>
              <span>{money(catSum)}</span>
            </div>
          {/each}
        </div>
      {/if}

      <div class={s.grand}>
        <span>TOTAL · {data.items.length}</span>
        <strong class={s.totalDigits}>{money(total)}</strong>
      </div>

      <div class={s.barcodeBlock} aria-hidden="true">
        <div class={s.barcode}>
          <i></i><i data-wide="true"></i><i></i><i data-wide="true"></i><i></i><i></i><i data-wide="true"></i><i></i>
          <i data-wide="true"></i><i></i><i></i><i data-wide="true"></i><i></i><i data-wide="true"></i><i></i><i></i>
          <i></i><i data-wide="true"></i><i></i><i></i><i data-wide="true"></i><i></i><i data-wide="true"></i><i></i>
        </div>
        <span class={s.barcodeLabel}>{printedOn.replaceAll("-", "")}-{String(Math.round(total * 100)).padStart(6, "0")}</span>
        <span class={s.barcodeLabel}>THANK YOU FOR LOGGING</span>
      </div>
    </footer>
  </div>

  <div class={s.tear} data-edge="bottom" aria-hidden="true">
    {#each Array.from({ length: 12 }) as _, index (index)}<i></i>{/each}
  </div>
</article>
