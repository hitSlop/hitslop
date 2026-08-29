<script lang="ts">
  import { Dialog, Select, Tabs } from "bits-ui";
  import { sql, sqliteQuery } from "@slop/svelte";
  import Check from "@lucide/svelte/icons/check";
  import ChevronsUpDown from "@lucide/svelte/icons/chevrons-up-down";
  import Pencil from "@lucide/svelte/icons/pencil";
  import Plus from "@lucide/svelte/icons/plus";
  import Power from "@lucide/svelte/icons/power";
  import Trash2 from "@lucide/svelte/icons/trash-2";
  import X from "@lucide/svelte/icons/x";

  type Subscription={id:number;name:string;amount_cents:number;cycle:string;next_due:string;category:string;active:number|boolean;note:string};
  const subscriptions=sqliteQuery<Subscription>("main",sql`SELECT id,name,amount_cents,cycle,next_due,category,active,note FROM subscriptions ORDER BY active DESC,next_due,id`);
  const cycles=["Monthly","Yearly"].map(value=>({value,label:value}));
  const categories=["Entertainment","Work","Home","Health","Other"].map(value=>({value,label:value}));
  const money=new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"});
  let view=$state("active");let dialogOpen=$state(false);let editingID=$state<number|null>(null);
  let name=$state("");let amount=$state("");let cycle=$state("Monthly");let nextDue=$state("2026-09-01");let category=$state("Entertainment");let note=$state("");
  const visible=$derived(subscriptions.current.filter(item=>view==="all"||Boolean(item.active)));
  const monthlyTotal=$derived(subscriptions.current.filter(item=>Boolean(item.active)).reduce((sum,item)=>sum+(item.cycle==="Yearly"?Number(item.amount_cents)/12:Number(item.amount_cents)),0));
  const yearlyTotal=$derived(monthlyTotal*12);
  function beginAdd():void{editingID=null;name="";amount="";cycle="Monthly";nextDue="2026-09-01";category="Entertainment";note="";dialogOpen=true}
  function beginEdit(item:Subscription):void{editingID=item.id;name=item.name;amount=(Number(item.amount_cents)/100).toFixed(2);cycle=item.cycle;nextDue=item.next_due;category=item.category;note=item.note;dialogOpen=true}
  async function save():Promise<void>{const clean=name.trim();const cents=Math.round(Number(amount)*100);if(!clean||!Number.isFinite(cents)||cents<=0||!nextDue)return;if(editingID===null)await subscriptions.execute(sql`INSERT INTO subscriptions (name,amount_cents,cycle,next_due,category,active,note) VALUES (${clean},${cents},${cycle},${nextDue},${category},1,${note.trim()})`);else await subscriptions.execute(sql`UPDATE subscriptions SET name=${clean},amount_cents=${cents},cycle=${cycle},next_due=${nextDue},category=${category},note=${note.trim()} WHERE id=${editingID}`);dialogOpen=false;editingID=null}
  async function toggle(item:Subscription):Promise<void>{await subscriptions.execute(sql`UPDATE subscriptions SET active=${Boolean(item.active)?0:1} WHERE id=${item.id}`)}
  async function remove():Promise<void>{if(editingID===null)return;await subscriptions.execute(sql`DELETE FROM subscriptions WHERE id=${editingID}`);dialogOpen=false;editingID=null}
  function dueLabel(value:string):string{return new Intl.DateTimeFormat("en",{month:"short",day:"numeric"}).format(new Date(`${value}T12:00:00`))}
</script>

<main class="subscriptions" data-slop-selection="none">
  <header><div><p>RECURRING COSTS</p><h1>Subscriptions</h1></div><button class="add" onclick={beginAdd}><Plus/>Add subscription</button></header>
  <section class="summary"><div><span>Monthly</span><strong>{money.format(monthlyTotal/100)}</strong></div><div><span>Yearly pace</span><b>{money.format(yearlyTotal/100)}</b></div><i aria-hidden="true"></i></section>
  <Tabs.Root bind:value={view} class="content"><div class="list-head"><Tabs.List class="tabs" aria-label="Subscription view"><Tabs.Trigger value="active">Active</Tabs.Trigger><Tabs.Trigger value="all">All</Tabs.Trigger></Tabs.List><span>{visible.length} services</span></div>
    <Tabs.Content value={view} class="list-panel"><ol>{#each visible as item (item.id)}<li class:paused={!Boolean(item.active)}><button class="service" onclick={()=>beginEdit(item)} aria-label={`Edit ${item.name}`}><span class="service-mark">{item.name.slice(0,1)}</span><span class="service-copy"><strong>{item.name}</strong><small>{item.category}{item.note?` · ${item.note}`:""}</small></span><span class="renewal"><small>RENews</small><time>{dueLabel(item.next_due)}</time></span><span class="price"><b>{money.format(Number(item.amount_cents)/100)}</b><small>/{item.cycle==="Yearly"?"yr":"mo"}</small></span><Pencil/></button><button class="power" onclick={()=>void toggle(item)} aria-label={Boolean(item.active)?`Pause ${item.name}`:`Resume ${item.name}`}><Power/></button></li>{/each}</ol>{#if visible.length===0}<div class="empty"><strong>Nothing recurring yet.</strong><span>Add the first service you want to keep an eye on.</span></div>{/if}</Tabs.Content>
  </Tabs.Root>
  <footer><span>{subscriptions.current.filter(item=>Boolean(item.active)).length} active</span><span>Tap any service to edit</span></footer>
  {#if subscriptions.error}<p class="error">Subscriptions could not be updated.</p>{/if}

  <Dialog.Root bind:open={dialogOpen}><Dialog.Portal><Dialog.Overlay class="overlay"/><Dialog.Content class="dialog"><form onsubmit={(event)=>{event.preventDefault();void save()}}><p>{editingID===null?"NEW SUBSCRIPTION":"EDIT SUBSCRIPTION"}</p><Dialog.Title>{editingID===null?"Add a recurring cost":"Update the details"}</Dialog.Title><Dialog.Description>Track the amount and next renewal date.</Dialog.Description><label>Name<input bind:value={name} placeholder="Service name"/></label><div class="form-row"><label>Amount<input type="number" min="0" step="0.01" bind:value={amount} placeholder="0.00"/></label><label>Next renewal<input type="date" bind:value={nextDue}/></label></div><div class="form-row"><label>Billing<Select.Root type="single" bind:value={cycle} items={cycles}><Select.Trigger type="button" class="select-trigger"><Select.Value/><ChevronsUpDown/></Select.Trigger><Select.Portal><Select.Content class="select-menu"><Select.Viewport>{#each cycles as item}<Select.Item class="select-item" value={item.value} label={item.label}>{#snippet children({selected})}{item.label}{#if selected}<Check/>{/if}{/snippet}</Select.Item>{/each}</Select.Viewport></Select.Content></Select.Portal></Select.Root></label><label>Category<Select.Root type="single" bind:value={category} items={categories}><Select.Trigger type="button" class="select-trigger"><Select.Value/><ChevronsUpDown/></Select.Trigger><Select.Portal><Select.Content class="select-menu"><Select.Viewport>{#each categories as item}<Select.Item class="select-item" value={item.value} label={item.label}>{#snippet children({selected})}{item.label}{#if selected}<Check/>{/if}{/snippet}</Select.Item>{/each}</Select.Viewport></Select.Content></Select.Portal></Select.Root></label></div><label>Note<input bind:value={note} placeholder="Optional detail"/></label><div class="actions">{#if editingID!==null}<button class="delete" type="button" onclick={()=>void remove()}><Trash2/>Delete</button>{/if}<Dialog.Close type="button">Cancel</Dialog.Close><button type="submit">{editingID===null?"Add subscription":"Save changes"}</button></div></form><Dialog.Close class="close" aria-label="Close"><X/></Dialog.Close></Dialog.Content></Dialog.Portal></Dialog.Root>
</main>
