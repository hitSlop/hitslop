<script lang="ts">
  type Status = "Draft" | "Sent" | "Paid";
  type Line = { description: string; quantity: number; rate: number };

  let number = $state("INV-042");
  let status = $state<Status>("Sent");
  let from = $state("Longtail Labs");
  let client = $state("Northwind Studio");
  let taxPercent = $state(5);
  let lines = $state<Line[]>([
    { description: "Product strategy", quantity: 1, rate: 1200 },
    { description: "Interface direction", quantity: 8, rate: 140 },
  ]);

  const subtotal = $derived(lines.reduce((sum, line) => sum + Number(line.quantity || 0) * Number(line.rate || 0), 0));
  const tax = $derived(subtotal * Number(taxPercent || 0) / 100);
  const total = $derived(subtotal + tax);
  const money = (value: number): string => new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 }).format(value);

  function addLine(): void {
    lines = [...lines, { description: "New service", quantity: 1, rate: 100 }];
  }

  function removeLine(index: number): void {
    if (lines.length <= 1) return;
    lines = lines.filter((_, lineIndex) => lineIndex !== index);
  }
</script>

<article class="invoice" aria-label={`Invoice ${number}`}>
  <header>
    <label class="identity"><span>Invoice</span><input aria-label="Invoice number" bind:value={number} /></label>
    <label class="status"><span class="sr-only">Invoice status</span><select bind:value={status}><option>Draft</option><option>Sent</option><option>Paid</option></select></label>
  </header>

  <section class="dates" aria-label="Invoice dates">
    <span>Issued<strong>Sep 2, 2026</strong></span>
    <span>Due<strong>Sep 16, 2026</strong></span>
    <span>Currency<strong>CAD</strong></span>
  </section>

  <section class="parties" aria-label="Invoice parties">
    <label><span>From</span><input bind:value={from} aria-label="From" /></label>
    <label><span>Bill to</span><input bind:value={client} aria-label="Bill to" /></label>
  </section>

  <section class="line-items" aria-label="Invoice line items">
    <div class="line-heading"><span>Description</span><span>Qty</span><span>Rate</span><span>Amount</span><i></i></div>
    {#each lines as line, index}
      <div class="line">
        <input class="description" aria-label={`Description for line ${index + 1}`} bind:value={line.description} />
        <input aria-label={`Quantity for line ${index + 1}`} type="number" min="0" bind:value={line.quantity} />
        <input aria-label={`Rate for line ${index + 1}`} type="number" min="0" bind:value={line.rate} />
        <output>{money(line.quantity * line.rate)}</output>
        <button type="button" onclick={() => removeLine(index)} aria-label={`Remove ${line.description}`}>×</button>
      </div>
    {/each}
    <button class="add-line" type="button" onclick={addLine}>+ Add line item</button>
  </section>

  <section class="closing">
    <p>Thank you for your business.<small>Interactive demo · resets on refresh</small></p>
    <dl>
      <div><dt>Subtotal</dt><dd>{money(subtotal)}</dd></div>
      <div><dt><label>Tax <input aria-label="Tax percentage" type="number" min="0" bind:value={taxPercent} /><span>%</span></label></dt><dd>{money(tax)}</dd></div>
      <div class="total"><dt>Total</dt><dd>{money(total)}</dd></div>
    </dl>
  </section>
</article>

<style>
  :global(*) { box-sizing: border-box; }
  input, select, button { font: inherit; }
  .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
  .invoice {
    --paper: oklch(98% 0.018 86);
    --ink: oklch(24% 0.025 60);
    --muted: oklch(49% 0.025 65);
    --rule: oklch(84% 0.025 75);
    width: min(100%, 610px);
    min-height: 650px;
    padding: clamp(28px, 7cqw, 52px);
    color: var(--ink);
    border: 1px solid oklch(81% 0.03 70);
    border-radius: 7px;
    background: linear-gradient(100deg, oklch(93% 0.025 80 / .42), transparent 16%), var(--paper);
    box-shadow: 0 1px 0 oklch(100% 0 0) inset, 0 25px 55px oklch(30% 0.04 60 / .16);
    container-type: inline-size;
    font-family: "Onest", "Avenir Next", sans-serif;
  }
  header { display: flex; align-items: start; justify-content: space-between; gap: 24px; }
  .identity { display: grid; gap: 3px; }
  .identity span { font-family: "Newsreader", Georgia, serif; font-size: 24px; line-height: 1; }
  .identity input { width: 145px; padding: 0; border: 0; color: var(--ink); background: transparent; font-size: 13px; font-weight: 750; outline: none; }
  .status select { height: 32px; padding: 0 28px 0 12px; border: 1px solid oklch(71% 0.08 141); border-radius: 999px; color: oklch(35% 0.09 141); background: oklch(92% 0.06 141); font-size: 11px; font-weight: 750; }
  .dates { margin-top: 28px; padding: 15px 0; display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; border-block: 1px solid var(--rule); }
  .dates span, .parties label { display: grid; gap: 4px; color: var(--muted); font-size: 9px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }
  .dates strong { color: var(--ink); font-size: 11px; letter-spacing: 0; text-transform: none; }
  .parties { margin-top: 28px; display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
  .parties input { width: 100%; padding: 5px 0; border: 0; border-bottom: 1px solid transparent; color: var(--ink); background: transparent; font-size: 13px; font-weight: 650; text-transform: none; outline: none; }
  .parties input:focus { border-color: var(--ink); }
  .line-items { margin-top: 38px; }
  .line-heading, .line { display: grid; grid-template-columns: minmax(120px, 1fr) 48px 72px 80px 26px; gap: 8px; align-items: center; }
  .line-heading { padding-bottom: 9px; color: var(--muted); border-bottom: 1px solid var(--ink); font-size: 8px; font-weight: 750; letter-spacing: .07em; text-transform: uppercase; }
  .line { min-height: 48px; border-bottom: 1px solid var(--rule); }
  .line input { min-width: 0; width: 100%; padding: 7px 3px; border: 0; color: var(--ink); background: transparent; font-size: 10px; outline: none; }
  .line input:not(.description) { text-align: right; font-variant-numeric: tabular-nums; }
  .line output { text-align: right; font-size: 10px; font-weight: 750; font-variant-numeric: tabular-nums; }
  .line button { width: 25px; height: 25px; padding: 0; border: 0; border-radius: 50%; color: var(--muted); background: transparent; cursor: pointer; }
  .line button:hover { color: oklch(50% 0.17 28); background: oklch(93% 0.04 28); }
  .add-line { min-height: 38px; padding: 0; border: 0; color: var(--muted); background: transparent; font-size: 9px; font-weight: 750; cursor: pointer; }
  .closing { margin-top: 34px; display: grid; grid-template-columns: 1fr 190px; gap: 30px; align-items: end; }
  .closing p { margin: 0; color: var(--muted); font-family: "Newsreader", Georgia, serif; font-size: 16px; font-style: italic; }
  .closing small { margin-top: 9px; display: block; font-family: "Onest", sans-serif; font-size: 7px; font-style: normal; font-weight: 650; letter-spacing: .04em; }
  dl { margin: 0; display: grid; gap: 9px; }
  dl div { display: flex; justify-content: space-between; gap: 16px; color: var(--muted); font-size: 10px; }
  dt, dd { margin: 0; }
  dt label { display: inline-flex; align-items: center; gap: 2px; }
  dt input { width: 30px; padding: 0; border: 0; border-bottom: 1px solid var(--rule); color: var(--muted); background: transparent; text-align: right; outline: none; }
  .total { padding-top: 10px; border-top: 1px solid var(--ink); color: var(--ink); font-size: 15px; font-weight: 800; }
  input:focus-visible, select:focus-visible, button:focus-visible { outline: 2px solid oklch(54% 0.16 254); outline-offset: 2px; }
  @container (width < 480px) {
    .invoice { min-height: 610px; padding: 28px 24px; }
    .dates { grid-template-columns: 1fr 1fr; }
    .dates span:last-child { display: none; }
    .parties { grid-template-columns: 1fr; gap: 14px; }
    .parties label:first-child { display: none; }
    .line-heading, .line { grid-template-columns: minmax(95px, 1fr) 38px 60px 70px 20px; gap: 4px; }
    .closing { grid-template-columns: 1fr; }
    .closing p { display: none; }
    dl { width: 180px; justify-self: end; }
  }
</style>
