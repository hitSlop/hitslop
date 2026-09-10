<script lang="ts">
  import { ready } from "@hitslop/runtime";
  import { jsonStore, IconTarget, ExportTarget } from "@hitslop/svelte";
  import { onDestroy } from "svelte";
  import { Select, Button } from "bits-ui";
  import Check from "@lucide/svelte/icons/check";
  import ChevronDown from "@lucide/svelte/icons/chevron-down";
  import Plus from "@lucide/svelte/icons/plus";
  import Trash2 from "@lucide/svelte/icons/trash-2";
  import invoiceSchema from "../schema";
  import type { Invoice } from "../schema";
  import Icon from "./Icon.svelte";
  import Export from "./Export.svelte";
  import * as s from "./styles.css";

  const statuses = [
    { value: "draft", label: "Draft" },
    { value: "sent", label: "Sent" },
    { value: "paid", label: "Paid" },
  ] as const;
  const currencies = ["USD", "CAD", "EUR", "GBP", "AUD", "JPY"].map(value => ({ value, label: value }));

  function dateValue(date: Date): string {
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
    return local.toISOString().slice(0, 10);
  }
  const today = new Date();
  const due = new Date(today); due.setDate(due.getDate() + 14);

  const invoice = jsonStore({ schema: invoiceSchema, initial: {
    number: "INV-001",
    status: "draft",
    issued: dateValue(today),
    due: dateValue(due),
    from: { name: "Northwind Studio", detail: "14 Market Lane\nPortland, OR" },
    billTo: { name: "Harbor Goods", detail: "88 Pier Street\nSeattle, WA" },
    items: [{ id: "initial-line-item", description: "Brand system and invoice template", quantity: 1, rate: 2400 }],
    taxPercent: 0,
    notes: "Due on receipt. Thank you.",
    currency: "USD",
  } });
  $effect(() => { if (invoice.isReady) ready(); });
  onDestroy(() => invoice.destroy());

  const subtotal = $derived(invoice.current.items.reduce((sum, item) => sum + (item.quantity ?? 0) * (item.rate ?? 0), 0));
  const tax = $derived(subtotal * (invoice.current.taxPercent ?? 0) / 100);
  const total = $derived(subtotal + tax);

  function money(value: number): string {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: invoice.current.currency }).format(value);
  }
</script>

<main class={s.canvas} data-slop-selection="none" aria-busy={invoice.isLoading}>
  <article class={s.invoice} aria-label="Invoice {invoice.current.number}">
    <header class={s.masthead}>
      <div>
        <span class={s.eyebrow}>Invoice</span>
        <label class={s.numberField}>
          <span class={s.srOnly}>Invoice number</span>
          <input bind:value={invoice.current.number} />
        </label>
      </div>
      <Select.Root type="single" value={invoice.current.status} items={[...statuses]} onValueChange={value => { if (statuses.some(item => item.value === value)) invoice.current.status = value; }}>
        <Select.Trigger class={s.statusTrigger} aria-label="Invoice status">
          <span class={s.statusDot} data-status={invoice.current.status}></span>
          <Select.Value placeholder="Status" />
          <ChevronDown size={13} data-slop-export="hide" strokeWidth={1.8} />
        </Select.Trigger>
        <Select.Portal>
          <Select.Content class={s.selectContent} sideOffset={6}>
            <Select.Viewport>
              {#each statuses as item (item.value)}
                <Select.Item value={item.value} label={item.label}>
                  {#snippet children({ selected })}{item.label}{#if selected}<Check size={13} strokeWidth={1.8} />{/if}{/snippet}
                </Select.Item>
              {/each}
            </Select.Viewport>
          </Select.Content>
        </Select.Portal>
      </Select.Root>
    </header>

    <section class={s.meta} aria-label="Invoice details">
      <label><span>Issued</span><input type="date" bind:value={invoice.current.issued} /></label>
      <label><span>Due</span><input type="date" bind:value={invoice.current.due} /></label>
      <div>
        <span>Currency</span>
        <Select.Root type="single" value={invoice.current.currency} items={currencies} onValueChange={value => { if (currencies.some(item => item.value === value)) invoice.current.currency = value; }}>
          <Select.Trigger class={s.currencyTrigger} aria-label="Invoice currency">
            <Select.Value placeholder="Currency" />
            <ChevronDown size={12} data-slop-export="hide" strokeWidth={1.8} />
          </Select.Trigger>
          <Select.Portal>
            <Select.Content class={s.selectContent} sideOffset={6}>
              <Select.Viewport>
                {#each currencies as item (item.value)}
                  <Select.Item value={item.value} label={item.label}>
                    {#snippet children({ selected })}{item.label}{#if selected}<Check size={13} strokeWidth={1.8} />{/if}{/snippet}
                  </Select.Item>
                {/each}
              </Select.Viewport>
            </Select.Content>
          </Select.Portal>
        </Select.Root>
      </div>
    </section>

    <section class={s.parties} aria-label="Invoice parties">
      <label class={s.party}><span>From</span><input aria-label="From name" placeholder="Your name or company" bind:value={invoice.current.from.name} /><textarea aria-label="From details" placeholder="Address and contact details" bind:value={invoice.current.from.detail}></textarea></label>
      <label class={s.party}><span>Bill to</span><input aria-label="Bill-to name" placeholder="Client name or company" bind:value={invoice.current.billTo.name} /><textarea aria-label="Bill-to details" placeholder="Address and contact details" bind:value={invoice.current.billTo.detail}></textarea></label>
    </section>

    <section class={s.lines}>
      <div class={s.lineHeading}><h2>Description</h2><span>Qty</span><span>Rate</span><span>Amount</span><span data-slop-export="hide"></span></div>
      {#each invoice.current.items as item, index (item.id)}
        <div class={s.line}>
          <label><span class={s.mobile}>Item</span><input aria-label="Description for line {index + 1}" placeholder="Service or item" bind:value={item.description} /></label>
          <label><span class={s.mobile}>Qty</span><input aria-label="Quantity for line {index + 1}" type="number" min="0" step="0.01" bind:value={item.quantity} /></label>
          <label><span class={s.mobile}>Rate</span><input aria-label="Rate for line {index + 1}" type="number" min="0" step="0.01" bind:value={item.rate} /></label>
          <output class={s.amount}><span class={s.mobile}>Amount</span>{money((item.quantity ?? 0) * (item.rate ?? 0))}</output>
          <button class={s.remove} data-slop-export="hide" aria-label="Remove line {index + 1}" onclick={() => { invoice.current.items = invoice.current.items.filter(row => row.id !== item.id); }}><Trash2 size={13} strokeWidth={1.7} /></button>
        </div>
      {/each}
      <Button.Root class={s.add} data-slop-export="hide" onclick={() => invoice.current.items.push({ id: crypto.randomUUID(), description: "", quantity: 1, rate: 0 })}><Plus size={14} strokeWidth={1.8} /> Add line item</Button.Root>
    </section>

    <section class={s.closing}>
      <label class={s.notes}><span>Notes & terms</span><textarea placeholder="Payment terms, delivery notes, or a thank-you" bind:value={invoice.current.notes}></textarea></label>
      <dl class={s.totals}>
        <div><dt>Subtotal</dt><dd>{money(subtotal)}</dd></div>
        <div><dt>Tax <input aria-label="Tax percentage" type="number" min="0" step="0.1" bind:value={invoice.current.taxPercent} />%</dt><dd>{money(tax)}</dd></div>
        <div class={s.grand}><dt>Total</dt><dd>{money(total)}</dd></div>
      </dl>
    </section>
  </article>
</main>

<IconTarget><Icon /></IconTarget>
<ExportTarget><Export data={invoice.current} /></ExportTarget>
