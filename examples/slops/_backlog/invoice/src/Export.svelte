<script lang="ts">
  import type { Invoice } from "../schema";
  import * as s from "./styles.css";
  let { data }: { data: Invoice } = $props();
  const subtotal = $derived(data.items.reduce((sum, item) => sum + (item.quantity ?? 0) * (item.rate ?? 0), 0));
  const tax = $derived(subtotal * (data.taxPercent ?? 0) / 100);
  const money = (value: number) => new Intl.NumberFormat(undefined, { style: "currency", currency: data.currency }).format(value);
</script>
<article class={s.invoice} aria-label="Exported invoice {data.number}">
  <header class={s.masthead}>
    <div><span class={s.eyebrow}>Invoice</span><h1 class={s.numberField}>{data.number}</h1></div>
    <span class={s.statusTrigger}><span class={s.statusDot} data-status={data.status}></span>{data.status}</span>
  </header>
  <section class={s.meta}><div><span>Issued</span><strong>{data.issued}</strong></div><div><span>Due</span><strong>{data.due}</strong></div><div><span>Currency</span><strong>{data.currency}</strong></div></section>
  <section class={s.parties}>
    <div class={s.party}><span>From</span><strong>{data.from.name}</strong><p>{data.from.detail}</p></div>
    <div class={s.party}><span>Bill to</span><strong>{data.billTo.name}</strong><p>{data.billTo.detail}</p></div>
  </section>
  <section class={s.lines}>
    <div class={s.lineHeading}><h2>Description</h2><span>Qty</span><span>Rate</span><span>Amount</span></div>
    {#each data.items as item (item.id)}
      <div class={s.line}><span>{item.description}</span><span>{item.quantity ?? 0}</span><span>{money(item.rate ?? 0)}</span><span class={s.amount}>{money((item.quantity ?? 0) * (item.rate ?? 0))}</span></div>
    {/each}
  </section>
  <section class={s.closing}>
    <div class={s.notes}><span>Notes & terms</span><p>{data.notes}</p></div>
    <dl class={s.totals}>
      <div><dt>Subtotal</dt><dd>{money(subtotal)}</dd></div>
      <div><dt>Tax</dt><dd>{money(tax)}</dd></div>
      <div class={s.grand}><dt>Total</dt><dd>{money(subtotal + tax)}</dd></div>
    </dl>
  </section>
</article>
