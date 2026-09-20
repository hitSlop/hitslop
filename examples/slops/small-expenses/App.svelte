<script lang="ts">
  import { Checkbox, Tabs } from "bits-ui";
  import { Slop, useDocument, bindText } from "@hitslop/document/svelte";
  import { tick } from "svelte";
  import { expenses } from "./schema";
  import * as css from "./styles.css";
  const doc=useDocument(expenses);
  const { title, currency, items } = doc.fields;
  const merchantInputs = new Map<string, HTMLInputElement>();
  function merchantInput(node: HTMLInputElement, id: string) {
    merchantInputs.set(id, node);
    return { destroy() { merchantInputs.delete(id); } };
  }
  let merchant=$state(""), amount=$state(""), note=$state(""), error=$state("");
  let selected=$state<string[]>([]);
  const selectedIDs=$derived(selected.filter(id=>doc.current.items.some(row=>row.$id===id)));
  const total=$derived(doc.current.items.reduce((sum,row)=>sum+row.amountMinor,0));
  const unsettled=$derived(doc.current.items.filter(row=>!row.settled).reduce((sum,row)=>sum+row.amountMinor,0));
  const money=(minor:number)=>new Intl.NumberFormat("en-CA",{style:"currency",currency:doc.current.currency}).format(minor/100);
  async function add() {
    if(!merchant.trim()){error="Add a merchant.";return;}
    if(!/^\d+(\.\d{1,2})?$/.test(amount.trim())){error="Enter an amount with at most two decimal places.";return;}
    const [whole,fraction=""]=amount.trim().split(".");
    const minor=Number(whole)*100+Number(fraction.padEnd(2,"0"));
    if(!Number.isSafeInteger(minor)){error="Amount is too large.";return;}
    error="";
    const { id } = items.insert({merchant:merchant.trim(),amountMinor:minor,...(note.trim()?{note:note.trim()}:{}),settled:false});
    merchant="";amount="";note="";
    await tick();
    merchantInputs.get(id)?.focus();
  }
  function settle() { doc.transaction(tx=>{for(const id of selectedIDs)tx.fields.items.item(id).settled.set(true)});selected=[]; }
</script>
<Slop document={doc}>
<main class={css.paper}>
  <div class={css.eyebrow}>Small expenses</div>
  <input class={css.title} aria-label="List title" use:bindText={title} />
  <div class={css.overview}>
    <div><div class={css.muted}>TOTAL RECORDED</div><div class={css.total} data-total>{money(total)}</div><div class={css.muted}>{money(unsettled)} still to settle</div></div>
    <Tabs.Root value={doc.current.currency} onValueChange={value=>currency.set(value as "CAD"|"USD"|"EUR")}>
      <Tabs.List class={css.currencies} aria-label="Currency">
        {#each ["CAD","USD","EUR"] as currency}<Tabs.Trigger class={css.currency} value={currency}>{currency}</Tabs.Trigger>{/each}
      </Tabs.List>
    </Tabs.Root>
  </div>
  <div class={css.toolbar}>
    <div class={css.selection}><Checkbox.Root class={css.check} aria-label="Select all expenses" checked={doc.current.items.length>0 && selectedIDs.length===doc.current.items.length} onCheckedChange={checked=>selected=checked?doc.current.items.map(row=>row.$id):[]}>
      {#if doc.current.items.length>0 && selectedIDs.length===doc.current.items.length}✓{/if}
    </Checkbox.Root><span class={css.muted}>{selectedIDs.length?`${selectedIDs.length} selected`:`${doc.current.items.length} expenses`}</span></div>
    <button class={css.button} aria-label="Settle selected expenses" disabled={!selectedIDs.length} onclick={settle}>Settle selected</button>
  </div>
  <ul class={css.list}>
    {#each doc.current.items as row,index (row.$id)}
      <li class={css.row} data-row-id={row.$id}>
        <Checkbox.Root class={css.check} aria-label={`Select ${row.merchant}`} checked={selectedIDs.includes(row.$id)} onCheckedChange={checked=>selected=checked?[...selectedIDs,row.$id]:selectedIDs.filter(id=>id!==row.$id)}>{#if selectedIDs.includes(row.$id)}✓{/if}</Checkbox.Root>
        <div>
          <input class={css.merchant} aria-label="Merchant text" use:bindText={items.item(row.$id).merchant} use:merchantInput={row.$id} />
          {#if row.note}<p class={css.note}>{row.note}</p>{/if}
          <div class={css.actions}>
            <button class={css.small} disabled={index===0} aria-label="Move expense up" onclick={()=>items.move(row.$id,{before:doc.current.items[index-1]!.$id})}>↑</button>
            <button class={css.small} disabled={index===doc.current.items.length-1} aria-label="Move expense down" onclick={()=>items.move(row.$id,{after:doc.current.items[index+1]!.$id})}>↓</button>
            {#if row.note!==undefined}<button class={css.small} onclick={()=>items.item(row.$id).note.clear()}>Clear note</button>{/if}
            <button class={css.small} onclick={()=>items.remove(row.$id)}>Remove</button>
          </div>
        </div>
        <div class={css.amount}>{money(row.amountMinor)}<div class={css.muted}>{row.settled?"Settled":"Unsettled"}</div></div>
      </li>
    {/each}
  </ul>
  {#if !doc.current.items.length}<p class={css.note}>Nothing recorded yet. Add your first expense below.</p>{/if}
  <form class={css.form} onsubmit={event=>{event.preventDefault();return add()}}>
    <input class={css.entry} aria-label="Merchant" placeholder="Merchant" bind:value={merchant} />
    <input class={css.entry} aria-label="Amount" inputmode="decimal" placeholder="0.00" bind:value={amount} />
    <input class={css.entry} aria-label="Note" placeholder="Note (optional)" bind:value={note} />
    <button class={css.button} disabled={!merchant.trim()||!amount.trim()}>Add</button>
  </form>
  {#if error}<p class={css.error} role="alert">{error}</p>{/if}
  <footer class={css.footer}><span>Amounts stay as entered; currency changes the label.</span></footer>
</main>
</Slop>
