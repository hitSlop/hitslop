<script lang="ts">
  import { Select } from "bits-ui";
  import { jsonStore } from "@hitslop/svelte";
  import Check from "@lucide/svelte/icons/check";
  import ChevronDown from "@lucide/svelte/icons/chevron-down";
  import Plus from "@lucide/svelte/icons/plus";
  import Trash2 from "@lucide/svelte/icons/trash-2";

  type Party = { name: string; detail: string };
  type LineItem = { id: number; description: string; quantity: number; rate: number };
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
    taxPercent: number;
    notes: string;
    currency: Currency;
    nextID: number;
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
    items: [{ id: 1, description: "", quantity: 1, rate: 0 }],
    taxPercent: 0,
    notes: "",
    currency: "USD",
    nextID: 2,
  });

  const subtotal = $derived(invoice.current.items.reduce((sum, item) => sum + item.quantity * item.rate, 0));
  const tax = $derived(subtotal * invoice.current.taxPercent / 100);
  const total = $derived(subtotal + tax);

  function money(value: number): string {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: invoice.current.currency }).format(value);
  }

  function update(mutate: (value: Invoice) => void): void { invoice.update(mutate); }
  function updateParty(side: "from" | "billTo", key: keyof Party, value: string): void {
    update((data) => { data[side][key] = value; });
  }
  function updateItem(id: number, key: "description" | "quantity" | "rate", value: string | number): void {
    update((data) => {
      const item = data.items.find((candidate) => candidate.id === id);
      if (!item) return;
      if (key === "description") item.description = String(value);
      else item[key] = Number(value) || 0;
    });
  }
  function addItem(): void {
    update((data) => {
      data.items.push({ id: data.nextID, description: "", quantity: 1, rate: 0 });
      data.nextID += 1;
    });
  }
  function removeItem(id: number): void {
    update((data) => { data.items = data.items.filter((item) => item.id !== id); });
  }
</script>

<main class="invoice-canvas" data-slop-selection="none">
  <article class="invoice" aria-label="Invoice {invoice.current.number}">
    <header class="masthead">
      <div class="identity">
        <span class="eyebrow">Invoice</span>
        <label class="number-field">
          <span class="sr-only">Invoice number</span>
          <input value={invoice.current.number} oninput={(event) => {
            const number = event.currentTarget.value;
            update((data) => { data.number = number; });
          }} />
        </label>
      </div>

      <Select.Root type="single" value={invoice.current.status} items={statuses} onValueChange={(value) => {
        if (statuses.some((item) => item.value === value)) update((data) => { data.status = value as Status; });
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
      <label><span>Issued</span><input type="date" value={invoice.current.issued} oninput={(event) => {
        const value = event.currentTarget.value; update((data) => { data.issued = value; });
      }} /></label>
      <label><span>Due</span><input type="date" value={invoice.current.due} oninput={(event) => {
        const value = event.currentTarget.value; update((data) => { data.due = value; });
      }} /></label>
      <div class="currency-field">
        <span>Currency</span>
        <Select.Root type="single" value={invoice.current.currency} items={currencies} onValueChange={(value) => {
          if (currencies.some((item) => item.value === value)) update((data) => { data.currency = value as Currency; });
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
      <label class="party"><span>From</span><input class="party-name" aria-label="From name" placeholder="Your name or company" value={invoice.current.from.name} oninput={(event) => updateParty("from", "name", event.currentTarget.value)} /><textarea aria-label="From details" placeholder="Address and contact details" value={invoice.current.from.detail} oninput={(event) => updateParty("from", "detail", event.currentTarget.value)}></textarea></label>
      <label class="party"><span>Bill to</span><input class="party-name" aria-label="Bill-to name" placeholder="Client name or company" value={invoice.current.billTo.name} oninput={(event) => updateParty("billTo", "name", event.currentTarget.value)} /><textarea aria-label="Bill-to details" placeholder="Address and contact details" value={invoice.current.billTo.detail} oninput={(event) => updateParty("billTo", "detail", event.currentTarget.value)}></textarea></label>
    </section>

    <section class="line-items" aria-labelledby="line-items-title">
      <div class="line-heading" role="row">
        <h2 id="line-items-title">Description</h2><span>Qty</span><span>Rate</span><span>Amount</span><span data-slop-export="hide"></span>
      </div>
      <div class="line-list" role="table" aria-label="Invoice line items">
        {#each invoice.current.items as item, index (item.id)}
          <div class="line-item" role="row">
            <label class="description"><span class="mobile-label">Item</span><input aria-label="Description for line {index + 1}" placeholder="Service or item" value={item.description} oninput={(event) => updateItem(item.id, "description", event.currentTarget.value)} /></label>
            <label><span class="mobile-label">Qty</span><input aria-label="Quantity for line {index + 1}" type="number" min="0" step="0.01" value={item.quantity} oninput={(event) => updateItem(item.id, "quantity", event.currentTarget.value)} /></label>
            <label><span class="mobile-label">Rate</span><input aria-label="Rate for line {index + 1}" type="number" min="0" step="0.01" value={item.rate} oninput={(event) => updateItem(item.id, "rate", event.currentTarget.value)} /></label>
            <output class="line-total"><span class="mobile-label">Amount</span>{money(item.quantity * item.rate)}</output>
            <button class="remove-item" data-slop-export="hide" aria-label="Remove line {index + 1}" onclick={() => removeItem(item.id)}><Trash2 strokeWidth={1.7} absoluteStrokeWidth /></button>
          </div>
        {/each}
      </div>
      <button class="add-item" data-slop-export="hide" onclick={addItem}><Plus strokeWidth={1.8} absoluteStrokeWidth /> Add line item</button>
    </section>

    <section class="closing">
      <label class="notes"><span>Notes & terms</span><textarea placeholder="Payment terms, delivery notes, or a thank-you" value={invoice.current.notes} oninput={(event) => {
        const value = event.currentTarget.value; update((data) => { data.notes = value; });
      }}></textarea></label>
      <dl class="totals">
        <div><dt>Subtotal</dt><dd>{money(subtotal)}</dd></div>
        <div><dt><label>Tax <span class="tax-input"><input aria-label="Tax percentage" type="number" min="0" step="0.1" value={invoice.current.taxPercent} oninput={(event) => {
          const value = Number(event.currentTarget.value) || 0; update((data) => { data.taxPercent = value; });
        }} /><span>%</span></span></label></dt><dd>{money(tax)}</dd></div>
        <div class="total"><dt>Total</dt><dd>{money(total)}</dd></div>
      </dl>
    </section>

    <footer>
      <span>Thank you for your business</span>
      <span>{invoice.current.currency}</span>
      <span class:loading={invoice.isLoading} class:error={Boolean(invoice.error)} class="save-state" data-slop-export="hide">{invoice.error ? "Not saved" : invoice.isLoading ? "Opening" : "Saved locally"}</span>
    </footer>
    {#if invoice.error}<p class="error-message" data-slop-export="hide">Could not save this invoice. {invoice.error}</p>{/if}
  </article>
</main>
