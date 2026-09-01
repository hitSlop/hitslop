<script lang="ts">
  import { Select } from "bits-ui";
  import { jsonStore } from "@hitslop/svelte";
  import Check from "@lucide/svelte/icons/check";
  import ChevronDown from "@lucide/svelte/icons/chevron-down";
  import Plus from "@lucide/svelte/icons/plus";
  import Trash2 from "@lucide/svelte/icons/trash-2";

  type Party = { name: string; detail: string };
  type LineItem = { id: string; description: string; quantity: number | null; rate: number | null };
  type Status = "draft" | "sent" | "paid";
  type Currency = "USD" | "CAD" | "EUR" | "GBP" | "AUD" | "JPY";
  type Invoice = {
    number: string;
    status: Status;
    issued: string;
    due: string;
    from: Party;
    billTo: Party;
    items: LineItem[];
    taxPercent: number | null;
    notes: string;
    currency: Currency;
  };

  const statuses: { value: Status; label: string }[] = [
    { value: "draft", label: "Draft" },
    { value: "sent", label: "Sent" },
    { value: "paid", label: "Paid" },
  ];
  const currencies: { value: Currency; label: string }[] = [
    { value: "USD", label: "USD" },
    { value: "CAD", label: "CAD" },
    { value: "EUR", label: "EUR" },
    { value: "GBP", label: "GBP" },
    { value: "AUD", label: "AUD" },
    { value: "JPY", label: "JPY" },
  ];

  function dateValue(date: Date): string {
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
    return local.toISOString().slice(0, 10);
  }

  const today = new Date();
  const due = new Date(today); due.setDate(due.getDate() + 14);
  const invoice = jsonStore<Invoice>({
    number: "INV-001",
    status: "draft",
    issued: dateValue(today),
    due: dateValue(due),
    from: { name: "", detail: "" },
    billTo: { name: "", detail: "" },
    items: [{ id: "initial-line-item", description: "", quantity: 1, rate: 0 }],
    taxPercent: 0,
    notes: "",
    currency: "USD",
  });

  const subtotal = $derived(invoice.current.items.reduce((sum, item) => sum + (item.quantity ?? 0) * (item.rate ?? 0), 0));
  const tax = $derived(subtotal * (invoice.current.taxPercent ?? 0) / 100);
  const total = $derived(subtotal + tax);

  function money(value: number): string {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: invoice.current.currency }).format(value);
  }

  function addItem(): void {
    invoice.current.items.push({ id: crypto.randomUUID(), description: "", quantity: 1, rate: 0 });
  }
  function removeItem(id: string): void {
    invoice.current.items = invoice.current.items.filter((item) => item.id !== id);
  }
</script>

<main class="invoice-canvas" data-slop-selection="none">
  <article class="invoice" aria-label="Invoice {invoice.current.number}">
    <header class="masthead">
      <div class="identity">
        <span class="eyebrow">Invoice</span>
        <label class="number-field">
          <span class="sr-only">Invoice number</span>
          <input bind:value={invoice.current.number} />
        </label>
      </div>

      <Select.Root type="single" value={invoice.current.status} items={statuses} onValueChange={(value) => {
        if (statuses.some((item) => item.value === value)) invoice.current.status = value as Status;
      }}>
        <Select.Trigger class="select-trigger status-trigger" aria-label="Invoice status">
          <span class="status-dot" data-status={invoice.current.status}></span>
          <Select.Value placeholder="Status" />
          <ChevronDown class="select-chevron" data-slop-export="hide" strokeWidth={1.8} absoluteStrokeWidth />
        </Select.Trigger>
        <Select.Portal>
          <Select.Content class="select-content" sideOffset={6}>
            <Select.Viewport>
              {#each statuses as item (item.value)}
                <Select.Item class="select-item" value={item.value} label={item.label}>
                  {#snippet children({ selected })}
                    {item.label}{#if selected}<Check strokeWidth={1.8} absoluteStrokeWidth />{/if}
                  {/snippet}
                </Select.Item>
              {/each}
            </Select.Viewport>
          </Select.Content>
        </Select.Portal>
      </Select.Root>
    </header>

    <section class="meta" aria-label="Invoice details">
      <label><span>Issued</span><input type="date" bind:value={invoice.current.issued} /></label>
      <label><span>Due</span><input type="date" bind:value={invoice.current.due} /></label>
      <div class="currency-field">
        <span>Currency</span>
        <Select.Root type="single" value={invoice.current.currency} items={currencies} onValueChange={(value) => {
          if (currencies.some((item) => item.value === value)) invoice.current.currency = value as Currency;
        }}>
          <Select.Trigger class="currency-trigger" aria-label="Invoice currency">
            <Select.Value placeholder="Currency" />
            <ChevronDown data-slop-export="hide" strokeWidth={1.8} absoluteStrokeWidth />
          </Select.Trigger>
          <Select.Portal>
            <Select.Content class="select-content currency-content" sideOffset={6}>
              <Select.Viewport>
                {#each currencies as item (item.value)}
                  <Select.Item class="select-item" value={item.value} label={item.label}>
                    {#snippet children({ selected })}
                      {item.label}{#if selected}<Check strokeWidth={1.8} absoluteStrokeWidth />{/if}
                    {/snippet}
                  </Select.Item>
                {/each}
              </Select.Viewport>
            </Select.Content>
          </Select.Portal>
        </Select.Root>
      </div>
    </section>

    <section class="parties" aria-label="Invoice parties">
      <label class="party"><span>From</span><input class="party-name" aria-label="From name" placeholder="Your name or company" bind:value={invoice.current.from.name} /><textarea aria-label="From details" placeholder="Address and contact details" bind:value={invoice.current.from.detail}></textarea></label>
      <label class="party"><span>Bill to</span><input class="party-name" aria-label="Bill-to name" placeholder="Client name or company" bind:value={invoice.current.billTo.name} /><textarea aria-label="Bill-to details" placeholder="Address and contact details" bind:value={invoice.current.billTo.detail}></textarea></label>
    </section>

    <section class="line-items" aria-labelledby="line-items-title">
      <div class="line-heading" role="row">
        <h2 id="line-items-title">Description</h2><span>Qty</span><span>Rate</span><span>Amount</span><span data-slop-export="hide"></span>
      </div>
      <div class="line-list" role="table" aria-label="Invoice line items">
        {#each invoice.current.items as item, index (item.id)}
          <div class="line-item" role="row">
            <label class="description"><span class="mobile-label">Item</span><input aria-label="Description for line {index + 1}" placeholder="Service or item" bind:value={item.description} /></label>
            <label><span class="mobile-label">Qty</span><input aria-label="Quantity for line {index + 1}" type="number" min="0" step="0.01" bind:value={item.quantity} /></label>
            <label><span class="mobile-label">Rate</span><input aria-label="Rate for line {index + 1}" type="number" min="0" step="0.01" bind:value={item.rate} /></label>
            <output class="line-total"><span class="mobile-label">Amount</span>{money((item.quantity ?? 0) * (item.rate ?? 0))}</output>
            <button class="remove-item" data-slop-export="hide" aria-label="Remove line {index + 1}" onclick={() => removeItem(item.id)}><Trash2 strokeWidth={1.7} absoluteStrokeWidth /></button>
          </div>
        {/each}
      </div>
      <button class="add-item" data-slop-export="hide" onclick={addItem}><Plus strokeWidth={1.8} absoluteStrokeWidth /> Add line item</button>
    </section>

    <section class="closing">
      <label class="notes"><span>Notes & terms</span><textarea placeholder="Payment terms, delivery notes, or a thank-you" bind:value={invoice.current.notes}></textarea></label>
      <dl class="totals">
        <div><dt>Subtotal</dt><dd>{money(subtotal)}</dd></div>
        <div><dt><label>Tax <span class="tax-input"><input aria-label="Tax percentage" type="number" min="0" step="0.1" bind:value={invoice.current.taxPercent} /><span>%</span></span></label></dt><dd>{money(tax)}</dd></div>
        <div class="total"><dt>Total</dt><dd>{money(total)}</dd></div>
      </dl>
    </section>

  </article>
</main>
