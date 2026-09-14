<script lang="ts">
  import type { Tracker } from "../schema";
  import CategoryMark from "./CategoryMark.svelte";
  import Repeat2 from "@lucide/svelte/icons/repeat-2";
  import * as s from "./styles.css";

  let { data, view }: { data: Tracker; view: "active" | "all" } = $props();

  const active = $derived(data.subscriptions.filter(item => item.active));
  const visible = $derived(
    [...data.subscriptions]
      .filter(item => view === "all" || item.active)
      .sort((a, b) => Number(b.active) - Number(a.active) || a.nextRenewal.localeCompare(b.nextRenewal) || a.name.localeCompare(b.name)),
  );
  const monthlyPace = $derived(active.reduce((total, item) => total + (item.cadence === "annual" ? item.amount / 12 : item.amount), 0));
  const money = (value: number) => new Intl.NumberFormat(undefined, { style: "currency", currency: data.currency }).format(value);
  function dateLabel(value: string): string {
    if (!value || Number.isNaN(new Date(`${value}T12:00:00`).getTime())) return "No date";
    return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(new Date(`${value}T12:00:00`));
  }
</script>

<article class={s.exportLedger} aria-label="Exported subscription ledger">
  <header class={s.masthead}>
    <div>

      <h1>Subscriptions<span class={s.headingLoop} aria-hidden="true"><Repeat2 size={24} /></span></h1>
    </div>
    <div class={s.currencyField}>
      <span>Currency</span>
      <strong class={s.currencyTrigger}>{data.currency}</strong>
    </div>
  </header>
  <section class={s.totals} aria-label="Active subscription totals">
    <div><span>Monthly total</span><strong>{money(monthlyPace)}</strong></div>
    <div><span>Yearly estimate</span><b>{money(monthlyPace * 12)}</b></div>
    <div class={s.totalNote}><span>{active.length} active service{active.length === 1 ? "" : "s"}</span></div>
  </section>
  <section class={s.services} aria-label={view === "active" ? "Active services" : "All services"}>
    <div class={s.listHead}>
      <h2>{view === "active" ? "Active services" : "All services"}</h2>
    </div>
    {#if visible.length}
      <ol class={s.serviceList}>
        {#each visible as item (item.id)}
          <li class={s.row} data-paused={!item.active}>
            <div class={s.serviceCopy}>
              <CategoryMark category={item.category} /><span class={s.serviceText}><strong>{item.name}</strong>
              <small>{item.category}{item.note ? ` · ${item.note}` : ""}</small></span>
            </div>
            <time>
              <span>{item.active ? "Renews" : "Paused"}</span>
              <b>{dateLabel(item.nextRenewal)}</b>
            </time>
            <output>
              <strong>{money(item.amount)}</strong>
              <small>/{item.cadence === "annual" ? "yr" : "mo"}</small>
            </output>
          </li>
        {/each}
      </ol>
    {:else}
      <div class={s.empty}>
        <strong>No recurring costs yet.</strong>
        <p>Add a service you want to keep an eye on.</p>
      </div>
    {/if}
  </section>
  <footer class={s.footer}>
    <span>{active.length} active service{active.length === 1 ? "" : "s"}</span>
    <span>{data.subscriptions.length} on the ledger</span>
  </footer>
</article>
