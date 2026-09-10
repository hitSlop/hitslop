<script lang="ts">
  import type { PersonalBudget } from "../schema";
  import * as s from "./styles.css";

  let { data }: { data: PersonalBudget } = $props();

  const totalSpent = $derived(data.categories.reduce((sum, cat) => sum + (Number(cat.spent) || 0), 0));
  const remaining = $derived(data.income - totalSpent);
  const remainingRatio = $derived(data.income > 0 ? Math.max(0, Math.min(100, (Math.max(0, remaining) / data.income) * 100)) : 0);
  const overspent = $derived(remaining < 0);

  function money(value: number): number {
    return Number.isFinite(value) ? value : 0;
  }
  function formatCurrency(num: number): string {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(num);
  }
  function categoryPercent(allocated: number, spent: number): number {
    const cap = money(allocated);
    const used = money(spent);
    if (cap <= 0) return used > 0 ? 100 : 0;
    return Math.max(0, Math.min(100, (used / cap) * 100));
  }
</script>

<article class={s.exportChassis} aria-label="Exported personal budget">
  <section class={s.ledger} aria-label="Monthly budget ledger">
    <div class={s.ledgerHead}>
      <h1 class={s.month}>{data.month.trim() || "Monthly budget"}</h1>
      <span class={s.pill}>Ledger</span>
    </div>

    <div class={s.hero} data-over={overspent}>
      <span class={s.heroLabel}>Remaining funds</span>
      <span class={s.heroValue}>{formatCurrency(remaining)}</span>
      <span class={s.heroSub}>{overspent ? "over monthly income" : "left of monthly income"}</span>
      <div class={s.remainingTrack} aria-hidden="true">
        <div class={s.remainingFill} style:transform={`scaleX(${remainingRatio / 100})`}></div>
      </div>
    </div>

    <div class={s.stats}>
      <div class={s.chip}>
        <span class={s.chipLabel}>Income</span>
        <span class={s.chipValue}>{formatCurrency(money(data.income))}</span>
      </div>
      <div class={s.chip}>
        <span class={s.chipLabel}>Expenses</span>
        <span class={s.chipValue}>{formatCurrency(totalSpent)}</span>
      </div>
      <div class={s.chip}>
        <span class={s.chipLabel}>Savings</span>
        <span class={s.chipValue}>{formatCurrency(money(data.savings))}</span>
      </div>
    </div>

    <div class={s.categories}>
      <div class={s.catHead}><span class={s.catTitle}>Categories</span></div>
      <ul class={s.catList}>
        {#each data.categories as cat (cat.id)}
          {@const percent = categoryPercent(cat.allocated, cat.spent)}
          {@const isOver = money(cat.spent) > money(cat.allocated)}
          <li class={s.catRow}>
            <div class={s.catMeta}>
              <span class={s.catSelect} data-active="true"><span class={s.catDot}></span></span>
              <span class={s.catName}>{cat.name.trim() || "Untitled"}</span>
              <div class={s.catFigures}>
                <span class={s.spent}>{formatCurrency(money(cat.spent))}</span>
                <span class={s.divider}>/</span>
                <span class={s.limit}>{formatCurrency(money(cat.allocated))}</span>
              </div>
            </div>
            <div class={s.catTrack} aria-hidden="true">
              <div class={s.catFill} data-over={isOver} style:transform={`scaleX(${percent / 100})`}></div>
            </div>
          </li>
        {:else}
          <li class={s.empty}><strong>No categories.</strong></li>
        {/each}
      </ul>
    </div>
  </section>

  <section class={s.calc} aria-label="Calculator readout">
    <div class={s.lcd}>
      <div class={s.lcdHistory}>{data.month.trim() || "Budget"}</div>
      <div class={s.lcdDigits}>{formatCurrency(remaining)}</div>
    </div>
    <div class={s.keys} aria-hidden="true">
      <span class={s.key} data-kind="fn">MC</span>
      <span class={s.key} data-kind="fn">MR</span>
      <span class={s.key} data-kind="fn">M+</span>
      <span class={s.key} data-kind="fn">M-</span>
      <span class={s.key}>7</span><span class={s.key}>8</span><span class={s.key}>9</span><span class={s.key} data-kind="op">÷</span>
      <span class={s.key}>4</span><span class={s.key}>5</span><span class={s.key}>6</span><span class={s.key} data-kind="op">×</span>
      <span class={s.key}>1</span><span class={s.key}>2</span><span class={s.key}>3</span><span class={s.key} data-kind="op">−</span>
      <span class={s.key} data-kind="fn">C</span><span class={s.key}>0</span><span class={s.key}>.</span><span class={s.key} data-kind="op">+</span>
      <span class={s.key} data-kind="accent">=</span>
    </div>
  </section>
</article>
