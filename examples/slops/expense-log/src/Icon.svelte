<script lang="ts">
  import type { ExpenseLog } from "../schema";
  import * as s from "./styles.css";

  let { data, total = 0 }: { data: ExpenseLog; total?: number } = $props();
  const symbol = $derived(data.currency.trim() || "$");
  const lines = $derived(data.items.slice(0, 4));
  const placeholders = [
    { title: "COFFEE", amount: 4.5 },
    { title: "METRO", amount: 2.9 },
    { title: "LUNCH", amount: 14.8 },
    { title: "BOOKS", amount: 22 },
  ];
  const shown = $derived(lines.length ? lines : placeholders);
  const shownTotal = $derived(lines.length ? total : placeholders.reduce((sum, item) => sum + item.amount, 0));
  function label(title: string): string {
    return title.trim().toUpperCase().slice(0, 12) || "ITEM";
  }
  function money(amount: number): string {
    return `${symbol}${amount.toFixed(2)}`;
  }
</script>

<div class={s.iconSurface} aria-hidden="true">
  <article class={s.iconReceipt}>
    <div class={s.iconTear}>
      {#each Array.from({ length: 8 }) as _, index (index)}<i></i>{/each}
    </div>
    <div class={s.iconBody}>
      <div class={s.iconHeader}>
        <span class={s.iconTitle}>EXPENSE LOG</span>
        <span class={s.iconSub}>{data.terminalId.trim() || "TERMINAL"}</span>
      </div>
      <div class={s.iconDash}></div>
      <div class={s.iconItems}>
        {#each shown as item}
          <div class={s.iconRow}><span>{label(item.title)}</span><strong>{money(item.amount)}</strong></div>
        {/each}
      </div>
      <div class={s.iconDouble}></div>
      <div class={s.iconTotal}>
        <span>TOTAL</span>
        <strong>{money(shownTotal)}</strong>
      </div>
      <div class={s.iconBarcode}>
        <i></i><i data-wide="true"></i><i></i><i></i><i data-wide="true"></i><i></i><i data-wide="true"></i><i></i>
        <i></i><i data-wide="true"></i><i></i><i data-wide="true"></i><i></i><i></i>
      </div>
    </div>
  </article>
</div>
