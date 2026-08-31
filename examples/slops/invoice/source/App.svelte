<script lang="ts">
  import { Dialog, Label, Select, Separator } from "bits-ui";
  import { jsonStore } from "@hitslop/svelte";
  import Check from "@lucide/svelte/icons/check";
  import ChevronsUpDown from "@lucide/svelte/icons/chevrons-up-down";
  import Plus from "@lucide/svelte/icons/plus";
  import X from "@lucide/svelte/icons/x";

  type Party = { name: string; detail: string };
  type Line = { id: number; description: string; qty: number; rate: number };
  type Status = "draft" | "sent" | "paid";
  type Invoice = {
    number: string;
    issued: string;
    due: string;
    from: Party;
    to: Party;
    items: Line[];
    taxRate: number;
    notes: string;
    status: Status;
    nextID: number;
  };

  const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
  const statuses: { value: Status; label: string }[] = [
    { value: "draft", label: "Draft" },
    { value: "sent", label: "Sent" },
    { value: "paid", label: "Paid" },
  ];

  const invoice = jsonStore<Invoice>({
    number: "INV-001",
    issued: "2026-04-01",
    due: "2026-04-15",
    from: { name: "", detail: "" },
    to: { name: "", detail: "" },
    items: [],
    taxRate: 0,
    notes: "",
    status: "draft",
    nextID: 1,
  });

  let adding = $state(false);
  let draftDescription = $state("");
  let draftQty = $state(1);
  let draftRate = $state(0);

  const subtotal = $derived(
    invoice.current.items.reduce((sum, item) => sum + item.qty * item.rate, 0)
  );
  const tax = $derived(subtotal * invoice.current.taxRate);
  const total = $derived(subtotal + tax);

  function focusOnMount(node: HTMLInputElement): { destroy: () => void } {
    const frame = requestAnimationFrame(() => node.focus());
    return { destroy: () => cancelAnimationFrame(frame) };
  }

  function setField(mutate: (value: Invoice) => void): void {
    invoice.update(mutate);
  }

  function addLine(): void {
    const description = draftDescription.trim();
    if (!description) return;
    const qty = Number(draftQty) || 0;
    const rate = Number(draftRate) || 0;
    invoice.update((data) => {
      data.items.push({ id: data.nextID, description, qty, rate });
      data.nextID += 1;
    });
    draftDescription = "";
    draftQty = 1;
    draftRate = 0;
    adding = false;
  }
</script>

<main class="invoice-page" data-slop-selection="none">
  <header class="invoice-masthead">
    <div class="invoice-identity">
      <p class="invoice-kicker">Studio account</p>
      <div class="invoice-number-wrap">
        <span aria-hidden="true">№</span>
        <input
          class="invoice-number"
          value={invoice.current.number}
          onchange={(event) => {
            const number = event.currentTarget.value;
            setField((data) => { data.number = number; });
          }}
          aria-label="Invoice number"
        />
      </div>
      <p class="invoice-kind">Invoice</p>
    </div>
    <Select.Root
      type="single"
      value={invoice.current.status}
      items={statuses}
      onValueChange={(value) => {
        if (statuses.some((status) => status.value === value)) {
          setField((data) => { data.status = value as Status; });
        }
      }}
    >
      <Select.Trigger
        class="status-trigger"
        aria-label="Invoice status"
      >
        <Select.Value placeholder="Status" />
        <ChevronsUpDown class="status-caret" strokeWidth={1.75} absoluteStrokeWidth />
      </Select.Trigger>
      <Select.Portal>
        <Select.Content
          class="status-menu"
          sideOffset={8}
        >
          <Select.Viewport>
            {#each statuses as item (item.value)}
              <Select.Item
                class="status-option"
                value={item.value}
                label={item.label}
              >
                {#snippet children({ selected })}
                  {item.label}
                  {#if selected}<Check class="status-check" strokeWidth={1.75} absoluteStrokeWidth />{/if}
                {/snippet}
              </Select.Item>
            {/each}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  </header>

  <section class="invoice-dates" aria-label="Invoice dates">
    <p>For services rendered</p>
    <label>Issued
      <input type="date" value={invoice.current.issued} onchange={(event) => {
        const issued = event.currentTarget.value;
        setField((data) => { data.issued = issued; });
      }} />
    </label>
    <label>Due
      <input type="date" value={invoice.current.due} onchange={(event) => {
        const due = event.currentTarget.value;
        setField((data) => { data.due = due; });
      }} />
    </label>
  </section>

  <section class="invoice-parties" aria-label="Invoice parties">
    <div class="party-block">
      <p class="section-label">From</p>
      <input class="party-name" value={invoice.current.from.name} onchange={(event) => {
        const name = event.currentTarget.value;
        setField((data) => { data.from.name = name; });
      }} aria-label="From name" />
      <textarea class="party-detail" value={invoice.current.from.detail} onchange={(event) => {
        const detail = event.currentTarget.value;
        setField((data) => { data.from.detail = detail; });
      }} aria-label="From address"></textarea>
    </div>
    <div class="party-block party-client">
      <p class="section-label">Prepared for</p>
      <input class="party-name" value={invoice.current.to.name} onchange={(event) => {
        const name = event.currentTarget.value;
        setField((data) => { data.to.name = name; });
      }} aria-label="Client name" />
      <textarea class="party-detail" value={invoice.current.to.detail} onchange={(event) => {
        const detail = event.currentTarget.value;
        setField((data) => { data.to.detail = detail; });
      }} aria-label="Client address"></textarea>
    </div>
  </section>

  <section class="line-section" aria-labelledby="line-items-title">
    <div class="line-heading" role="row">
      <h2 id="line-items-title">Work</h2>
      <span>Qty</span>
      <span>Rate</span>
      <span class="amount-heading">Amount</span>
      <span aria-hidden="true"></span>
    </div>
    <div class="line-list" role="table" aria-label="Invoice line items">
      {#each invoice.current.items as item (item.id)}
        <div class="line-row" role="row">
          <label class="line-description">
            <span class="mobile-caption">Item</span>
            <input aria-label="Item description" value={item.description} onchange={(event) => {
              const id = item.id;
              const description = event.currentTarget.value;
              setField((data) => {
                const row = data.items.find((entry) => entry.id === id);
                if (row) row.description = description;
              });
            }} />
          </label>
          <label class="line-number">
            <span class="mobile-caption">Qty</span>
            <input aria-label="Quantity for {item.description}" type="number" min="0" step="1" value={item.qty} onchange={(event) => {
              const id = item.id;
              const qty = Number(event.currentTarget.value) || 0;
              setField((data) => {
                const row = data.items.find((entry) => entry.id === id);
                if (row) row.qty = qty;
              });
            }} />
          </label>
          <label class="line-number">
            <span class="mobile-caption">Rate</span>
            <input aria-label="Rate for {item.description}" type="number" min="0" step="0.01" value={item.rate} onchange={(event) => {
              const id = item.id;
              const rate = Number(event.currentTarget.value) || 0;
              setField((data) => {
                const row = data.items.find((entry) => entry.id === id);
                if (row) row.rate = rate;
              });
            }} />
          </label>
          <div class="line-amount" role="cell">
            <span class="mobile-caption">Amount</span>
            <span>{money.format(item.qty * item.rate)}</span>
          </div>
          <button class="delete-line" aria-label="Delete {item.description}" onclick={() => setField((data) => {
            data.items = data.items.filter((entry) => entry.id !== item.id);
          })}><X aria-hidden="true" strokeWidth={1.75} absoluteStrokeWidth /></button>
        </div>
      {/each}
    </div>
  </section>

  {#if invoice.current.items.length === 0}
    <p class="invoice-empty">No work added yet. Add the first line item to begin the invoice.</p>
  {/if}

  <Dialog.Root bind:open={adding}>
    <Dialog.Trigger class="add-line">
      <Plus aria-hidden="true" strokeWidth={1.75} absoluteStrokeWidth /> Add line item
    </Dialog.Trigger>
    <Dialog.Portal>
      <Dialog.Overlay class="dialog-overlay" />
      <Dialog.Content class="line-dialog">
        <p class="dialog-kicker">Invoice detail</p>
        <Dialog.Title>Add line item</Dialog.Title>
        <Dialog.Description>Describe the work and set the quantity and rate.</Dialog.Description>
        <Separator.Root class="dialog-rule" />
        <Label.Root class="dialog-label" for="line-desc">Description</Label.Root>
        <input id="line-desc" class="dialog-input" bind:value={draftDescription} use:focusOnMount />
        <div class="dialog-columns">
          <label class="dialog-label">Quantity
            <input class="dialog-input" type="number" min="0" bind:value={draftQty} />
          </label>
          <label class="dialog-label">Rate
            <input class="dialog-input" type="number" min="0" step="0.01" bind:value={draftRate} />
          </label>
        </div>
        <div class="dialog-actions">
          <Dialog.Close class="dialog-cancel">Keep editing invoice</Dialog.Close>
          <button class="dialog-save" onclick={addLine}>Add line item</button>
        </div>
        <Dialog.Close class="dialog-close" aria-label="Close line item dialog"><X strokeWidth={1.75} absoluteStrokeWidth /></Dialog.Close>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>

  <div class="invoice-closing">
    <label class="notes-label"><span>Notes & terms</span>
      <textarea value={invoice.current.notes} onchange={(event) => {
        const notes = event.currentTarget.value;
        setField((data) => { data.notes = notes; });
      }}></textarea>
    </label>

    <dl class="invoice-totals">
    <div><dt>Subtotal</dt><dd>{money.format(subtotal)}</dd></div>
    <div>
      <dt>Tax</dt>
      <dd class="tax-value">
        <label><span class="sr-only">Tax rate</span><input type="number" min="0" step="0.01" value={invoice.current.taxRate} onchange={(event) => {
          const taxRate = Number(event.currentTarget.value) || 0;
          setField((data) => { data.taxRate = taxRate; });
        }} aria-label="Tax rate" /></label>
        <span>{money.format(tax)}</span>
      </dd>
    </div>
    <div class="grand-total"><dt>Total due</dt><dd>{money.format(total)}</dd></div>
    </dl>
  </div>

  {#if invoice.error}
    <p class="invoice-error">The invoice could not be saved. {invoice.error}</p>
  {/if}

  <footer class="invoice-footer"><span>Longtail Labs</span><span>Thank you for the work.</span></footer>
</main>
