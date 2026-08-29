<script lang="ts">
  import { Dialog, Select, Tabs } from "bits-ui";
  import { sql, sqliteQuery } from "@slop/svelte";
  import Check from "@lucide/svelte/icons/check";
  import ChevronsUpDown from "@lucide/svelte/icons/chevrons-up-down";
  import Pencil from "@lucide/svelte/icons/pencil";
  import Plus from "@lucide/svelte/icons/plus";
  import Trash2 from "@lucide/svelte/icons/trash-2";
  import X from "@lucide/svelte/icons/x";

  type Transaction = { id:number; merchant:string; amount_cents:number; category:string; spent_on:string; note:string };
  type CategoryTotal = { category:string; total_cents:number };
  const transactions = sqliteQuery<Transaction>("main", sql`SELECT id, merchant, amount_cents, category, spent_on, note FROM transactions ORDER BY spent_on DESC, id DESC`);
  const categoryTotals = sqliteQuery<CategoryTotal>("main", sql`SELECT category, SUM(amount_cents) AS total_cents FROM transactions GROUP BY category ORDER BY total_cents DESC`);
  const categories = ["Food", "Studio", "Travel", "Home", "Other"].map((value) => ({ value, label:value }));
  const money = new Intl.NumberFormat("en-US", { style:"currency", currency:"USD" });
  let period = $state<"month"|"all">("month");
  let adding = $state(false);
  let editingID = $state<number | null>(null);
  let merchant = $state(""); let amount = $state(""); let category = $state("Food"); let spentOn = $state("2026-08-28"); let note = $state("");
  const monthKey = "2026-08";
  const visible = $derived(transactions.current.filter((item) => period === "all" || item.spent_on.startsWith(monthKey)));
  const total = $derived(visible.reduce((sum,item) => sum + Number(item.amount_cents), 0));
  const maxCategory = $derived(Math.max(1, ...categoryTotals.current.map((item) => Number(item.total_cents))));

  function beginAdd():void{editingID=null;merchant="";amount="";category="Food";spentOn="2026-08-28";note="";adding=true}
  function beginEdit(item:Transaction):void{editingID=item.id;merchant=item.merchant;amount=(Number(item.amount_cents)/100).toFixed(2);category=item.category;spentOn=item.spent_on;note=item.note;adding=true}
  async function saveExpense():Promise<void>{
    const cleanMerchant=merchant.trim(); const cents=Math.round(Number(amount)*100); if(!cleanMerchant||!Number.isFinite(cents)||cents<=0)return;
    if(editingID===null)await transactions.execute(sql`INSERT INTO transactions (merchant, amount_cents, category, spent_on, note) VALUES (${cleanMerchant}, ${cents}, ${category}, ${spentOn}, ${note.trim()})`);
    else await transactions.execute(sql`UPDATE transactions SET merchant = ${cleanMerchant}, amount_cents = ${cents}, category = ${category}, spent_on = ${spentOn}, note = ${note.trim()} WHERE id = ${editingID}`);
    merchant="";amount="";note="";editingID=null;adding=false;
  }
  async function removeExpense(id:number):Promise<void>{await transactions.execute(sql`DELETE FROM transactions WHERE id = ${id}`)}
  function dateLabel(value:string):string{const date=new Date(`${value}T12:00:00`);return new Intl.DateTimeFormat("en",{month:"short",day:"numeric"}).format(date)}
</script>

<main class="pulse-shell" data-slop-selection="none">
  <header class="pulse-header"><div><p>Personal ledger / August</p><h1>Expense pulse</h1></div><div class="pulse-total"><span>Outflow</span><strong>{money.format(total/100)}</strong></div></header>
  <section class="receipt">
    <div class="receipt-top">
      <Tabs.Root bind:value={period}><Tabs.List class="period-tabs" aria-label="Expense period"><Tabs.Trigger value="month">August</Tabs.Trigger><Tabs.Trigger value="all">All time</Tabs.Trigger></Tabs.List></Tabs.Root>
      <Dialog.Root bind:open={adding}><button class="add-expense" type="button" onclick={beginAdd}><Plus />Log expense</button><Dialog.Portal><Dialog.Overlay class="expense-overlay"/><Dialog.Content class="expense-dialog"><form onsubmit={(event)=>{event.preventDefault();void saveExpense()}}><p>{editingID===null?"New expense":"Edit expense"}</p><Dialog.Title>{editingID===null?"Log an expense":"Update expense"}</Dialog.Title><Dialog.Description>Keep the details useful and easy to scan later.</Dialog.Description><label>Merchant<input bind:value={merchant} placeholder="Where did it go?"/></label><div class="form-grid"><label>Amount<input type="number" min="0" step="0.01" bind:value={amount} placeholder="0.00"/></label><label>Date<input type="date" bind:value={spentOn}/></label></div><label>Category<Select.Root type="single" bind:value={category} items={categories}><Select.Trigger class="category-trigger" type="button"><Select.Value placeholder="Category"/><ChevronsUpDown/></Select.Trigger><Select.Portal><Select.Content class="category-menu"><Select.Viewport>{#each categories as item}<Select.Item value={item.value} label={item.label} class="category-item">{#snippet children({selected})}{item.label}{#if selected}<Check/>{/if}{/snippet}</Select.Item>{/each}</Select.Viewport></Select.Content></Select.Portal></Select.Root></label><label>Note<input bind:value={note} placeholder="Optional context"/></label><div class="expense-actions"><Dialog.Close type="button">Cancel</Dialog.Close><button type="submit">{editingID===null?"Save expense":"Save changes"}</button></div></form><Dialog.Close class="expense-close" aria-label="Close"><X/></Dialog.Close></Dialog.Content></Dialog.Portal></Dialog.Root>
    </div>
    <div class="category-chart" aria-label="Spending by category">{#each categoryTotals.current.slice(0,4) as item,index (item.category)}<div class="category-row"><span>{String(index+1).padStart(2,"0")}</span><strong>{item.category}</strong><div><i style={`width:${Math.max(8,Number(item.total_cents)/maxCategory*100)}%`}></i></div><em>{money.format(Number(item.total_cents)/100)}</em></div>{/each}</div>
    <div class="receipt-heading"><span>Recent signal</span><span>{visible.length} entries</span></div>
    <ol class="expense-list">{#each visible.slice(0,6) as item (item.id)}<li><button class="expense-edit" type="button" onclick={()=>beginEdit(item)} aria-label={`Edit ${item.merchant}`}><span class="expense-date">{dateLabel(item.spent_on)}</span><span class="expense-copy"><strong>{item.merchant}</strong><small>{item.category}{item.note?` · ${item.note}`:""}</small></span><b>{money.format(Number(item.amount_cents)/100)}</b><Pencil/></button><button type="button" aria-label={`Delete ${item.merchant}`} onclick={()=>void removeExpense(item.id)}><Trash2/></button></li>{/each}</ol>
    {#if visible.length===0}<div class="expense-empty"><strong>No spending in view.</strong><span>Log the first expense or switch periods.</span></div>{/if}
  </section>
  <footer><span>{visible.length} expenses</span><span>Tap any expense to edit</span></footer>
  {#if transactions.error}<p class="pulse-error">The ledger could not be updated.</p>{/if}
</main>
