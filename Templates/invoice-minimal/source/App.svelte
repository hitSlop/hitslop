<script lang="ts">
  import { Select } from "bits-ui";
  import { jsonStore } from "@slop/svelte";
  import Check from "@lucide/svelte/icons/check";
  import ChevronDown from "@lucide/svelte/icons/chevron-down";
  import Plus from "@lucide/svelte/icons/plus";
  import Trash2 from "@lucide/svelte/icons/trash-2";
  type Party={name:string;detail:string}; type Item={id:number;name:string;qty:number;rate:number};
  type Invoice={number:string;status:string;issued:string;due:string;from:Party;to:Party;items:Item[];tax:number;notes:string;nextID:number};
  const invoice=jsonStore<Invoice>("state",{number:"2026-001",status:"Draft",issued:"",due:"",from:{name:"",detail:""},to:{name:"",detail:""},items:[],tax:0,notes:"",nextID:1});
  const statuses=["Draft","Sent","Paid"].map(value=>({value,label:value}));
  const subtotal=$derived(invoice.current.items.reduce((sum,item)=>sum+Number(item.qty)*Number(item.rate),0));
  const taxTotal=$derived(subtotal*Number(invoice.current.tax)); const total=$derived(subtotal+taxTotal);
  const money=new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"});
  function setField<K extends keyof Invoice>(key:K,value:Invoice[K]):void{invoice.update(data=>{data[key]=value})}
  function setParty(side:"from"|"to",key:keyof Party,value:string):void{invoice.update(data=>{data[side][key]=value})}
  function setItem(id:number,key:keyof Item,value:string|number):void{invoice.update(data=>{const item=data.items.find(entry=>entry.id===id);if(item)(item as Record<string,string|number>)[key]=value})}
  function addItem():void{invoice.update(data=>{data.items.push({id:data.nextID,name:"New service",qty:1,rate:0});data.nextID+=1})}
  function removeItem(id:number):void{invoice.update(data=>{data.items=data.items.filter(item=>item.id!==id)})}
</script>

<main class="invoice" data-slop-selection="none">
  <header><div><p>INVOICE</p><input class="invoice-no" aria-label="Invoice number" value={invoice.current.number} oninput={(e)=>setField("number",e.currentTarget.value)}/></div><Select.Root type="single" value={invoice.current.status} items={statuses} onValueChange={(value)=>value&&setField("status",value)}><Select.Trigger class="status"><Select.Value/><ChevronDown/></Select.Trigger><Select.Portal><Select.Content class="status-menu"><Select.Viewport>{#each statuses as item}<Select.Item class="status-item" value={item.value} label={item.label}>{#snippet children({selected})}{item.label}{#if selected}<Check/>{/if}{/snippet}</Select.Item>{/each}</Select.Viewport></Select.Content></Select.Portal></Select.Root></header>
  <section class="meta"><label>Issued<input type="date" value={invoice.current.issued} oninput={(e)=>setField("issued",e.currentTarget.value)}/></label><label>Due<input type="date" value={invoice.current.due} oninput={(e)=>setField("due",e.currentTarget.value)}/></label></section>
  <section class="parties"><label><span>From</span><input class="party-name" value={invoice.current.from.name} oninput={(e)=>setParty("from","name",e.currentTarget.value)}/><textarea value={invoice.current.from.detail} oninput={(e)=>setParty("from","detail",e.currentTarget.value)}></textarea></label><label><span>Bill to</span><input class="party-name" value={invoice.current.to.name} oninput={(e)=>setParty("to","name",e.currentTarget.value)}/><textarea value={invoice.current.to.detail} oninput={(e)=>setParty("to","detail",e.currentTarget.value)}></textarea></label></section>
  <section class="lines"><div class="line-head"><span>Description</span><span>Qty</span><span>Rate</span><span>Amount</span><span></span></div>{#each invoice.current.items as item (item.id)}<div class="line"><input value={item.name} aria-label="Description" oninput={(e)=>setItem(item.id,"name",e.currentTarget.value)}/><input type="number" min="0" value={item.qty} aria-label="Quantity" oninput={(e)=>setItem(item.id,"qty",Number(e.currentTarget.value))}/><input type="number" min="0" value={item.rate} aria-label="Rate" oninput={(e)=>setItem(item.id,"rate",Number(e.currentTarget.value))}/><strong>{money.format(item.qty*item.rate)}</strong><button aria-label={`Delete ${item.name}`} onclick={()=>removeItem(item.id)}><Trash2/></button></div>{/each}<button class="add" onclick={addItem}><Plus/>Add item</button></section>
  <section class="closing"><label>Notes<textarea value={invoice.current.notes} oninput={(e)=>setField("notes",e.currentTarget.value)}></textarea></label><dl><div><dt>Subtotal</dt><dd>{money.format(subtotal)}</dd></div><div><dt>Tax <input aria-label="Tax rate" type="number" step="0.01" min="0" value={invoice.current.tax} oninput={(e)=>setField("tax",Number(e.currentTarget.value))}/></dt><dd>{money.format(taxTotal)}</dd></div><div class="total"><dt>Total</dt><dd>{money.format(total)}</dd></div></dl></section>
  <footer><span>Thank you for your business</span><span>USD</span></footer>
</main>
