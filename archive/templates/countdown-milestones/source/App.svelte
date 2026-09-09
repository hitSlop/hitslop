<script lang="ts">
  import { Dialog, Progress } from "bits-ui";
  import { jsonStore } from "@slop/svelte";
  import Check from "@lucide/svelte/icons/check";
  import Pencil from "@lucide/svelte/icons/pencil";
  import Plus from "@lucide/svelte/icons/plus";
  import X from "@lucide/svelte/icons/x";
  type Milestone={id:number;title:string;date:string;done:boolean};
  type CountdownData={title:string;createdAt:string;targetDate:string;milestones:Milestone[];nextID:number};
  const countdown=jsonStore<CountdownData>("state",{title:"Launch day",createdAt:"2026-08-01",targetDate:"2026-12-12",milestones:[],nextID:1});
  let editing=$state(false);let draftTitle=$state("");let draftTarget=$state("");let milestoneTitle=$state("");let milestoneDate=$state("");
  const remaining=$derived(daysBetween(new Date(),new Date(`${countdown.current.targetDate}T12:00:00`)));
  const totalDays=$derived(Math.max(1,daysBetween(new Date(`${countdown.current.createdAt}T12:00:00`),new Date(`${countdown.current.targetDate}T12:00:00`))));
  const elapsed=$derived(Math.max(0,Math.min(100,Math.round((1-remaining/totalDays)*100))));
  const completed=$derived(countdown.current.milestones.filter((item)=>item.done).length);
  function daysBetween(from:Date,to:Date):number{return Math.max(0,Math.ceil((to.getTime()-from.getTime())/86400000))}
  function openEditor():void{draftTitle=countdown.current.title;draftTarget=countdown.current.targetDate;milestoneDate=countdown.current.targetDate;editing=true}
  function saveCountdown():void{const title=draftTitle.trim();if(!title||!draftTarget)return;countdown.update((data)=>{data.title=title;data.targetDate=draftTarget});editing=false}
  function addMilestone():void{const title=milestoneTitle.trim();if(!title||!milestoneDate)return;countdown.update((data)=>{data.milestones.push({id:data.nextID,title,date:milestoneDate,done:false});data.milestones.sort((a,b)=>a.date.localeCompare(b.date));data.nextID+=1});milestoneTitle=""}
  function toggle(id:number):void{countdown.update((data)=>{const item=data.milestones.find((entry)=>entry.id===id);if(item)item.done=!item.done})}
  function shortDate(value:string):string{return new Intl.DateTimeFormat("en",{month:"short",day:"numeric"}).format(new Date(`${value}T12:00:00`))}
</script>

<main class="count-shell" data-slop-selection="none">
  <header><span>LT / M–01</span><button onclick={openEditor} aria-label="Edit countdown"><Pencil/></button></header>
  <section class="count-stage"><p>Until</p><h1>{countdown.current.title}</h1><div class="day-readout"><strong>{String(remaining).padStart(2,"0")}</strong><span>days<br/>remain</span></div><Progress.Root value={elapsed} max={100} class="progress-track" aria-label={`${elapsed}% elapsed`}><i style={`transform:translateX(-${100-elapsed}%)`}></i></Progress.Root><div class="progress-label"><span>{shortDate(countdown.current.createdAt)}</span><b>{elapsed}%</b><span>{shortDate(countdown.current.targetDate)}</span></div></section>
  <section class="milestones"><div class="milestone-head"><span>Milestone path</span><strong>{completed}/{countdown.current.milestones.length}</strong></div><ol>{#each countdown.current.milestones.slice(0,4) as item,index (item.id)}<li class:done={item.done}><span>{String(index+1).padStart(2,"0")}</span><button class="milestone-check" onclick={()=>toggle(item.id)} aria-label={item.done?"Mark incomplete":"Mark complete"}>{#if item.done}<Check/>{/if}</button><div><strong>{item.title}</strong><small>{shortDate(item.date)}</small></div></li>{/each}</ol>{#if countdown.current.milestones.length===0}<p class="milestone-empty">Add the first checkpoint to give the wait a shape.</p>{/if}<button class="quick-add" onclick={openEditor}><Plus/>Edit path</button></section>
  {#if countdown.error}<p class="count-error">The countdown could not be saved.</p>{/if}
  <Dialog.Root bind:open={editing}><Dialog.Portal><Dialog.Overlay class="count-overlay"/><Dialog.Content class="count-dialog"><p>Adjust the horizon</p><Dialog.Title>Edit countdown</Dialog.Title><label>Title<input bind:value={draftTitle}/></label><label>Target date<input type="date" bind:value={draftTarget}/></label><div class="dialog-actions"><Dialog.Close>Cancel</Dialog.Close><button onclick={saveCountdown}>Save countdown</button></div><hr/><p>Add milestone</p><label>Milestone<input bind:value={milestoneTitle} placeholder="First public demo"/></label><label>Date<input type="date" bind:value={milestoneDate}/></label><button class="add-milestone" onclick={addMilestone}>Add to path</button><Dialog.Close class="count-close" aria-label="Close"><X/></Dialog.Close></Dialog.Content></Dialog.Portal></Dialog.Root>
</main>
