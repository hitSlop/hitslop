<script lang="ts">
  import { Dialog } from "bits-ui";
  import { jsonStore } from "@slop/svelte";
  import Dices from "@lucide/svelte/icons/dices";
  import Plus from "@lucide/svelte/icons/plus";
  import Settings2 from "@lucide/svelte/icons/settings-2";
  import Trash2 from "@lucide/svelte/icons/trash-2";
  import X from "@lucide/svelte/icons/x";
  type Option={id:number;label:string};type Pick={id:number;label:string;pickedAt:string};type PickerData={title:string;options:Option[];history:Pick[];nextID:number};
  const picker=jsonStore<PickerData>("state",{title:"Pick one",options:[],history:[],nextID:1});
  let editing=$state(false);let draft=$state("");let spinning=$state(false);let display=$state("");let timer:ReturnType<typeof setInterval>|null=null;
  const winner=$derived(display||picker.current.history[0]?.label||"Ready?");
  function setTitle(value:string):void{picker.update(data=>{data.title=value})}
  function addOption():void{const label=draft.trim();if(!label)return;picker.update((data)=>{data.options.push({id:data.nextID,label});data.nextID+=1});draft=""}
  function updateOption(id:number,value:string):void{picker.update(data=>{const option=data.options.find(item=>item.id===id);if(option)option.label=value})}
  function removeOption(id:number):void{picker.update((data)=>{data.options=data.options.filter((option)=>option.id!==id)})}
  function choose():void{if(spinning||picker.current.options.length===0)return;spinning=true;let steps=0;timer=setInterval(()=>{const options=picker.current.options;display=options[Math.floor(Math.random()*options.length)]?.label??"";steps+=1;if(steps<13)return;if(timer)clearInterval(timer);timer=null;const chosen=options[Math.floor(Math.random()*options.length)];if(!chosen){spinning=false;return}display=chosen.label;const pickedAt=new Date().toISOString();picker.update((data)=>{data.history.unshift({id:chosen.id,label:chosen.label,pickedAt});data.history=data.history.slice(0,5)});spinning=false},70)}
</script>

<main class="picker-shell" data-slop-selection="none" data-spinning={spinning}>
  <header><div><span>CHOOSE FOR ME</span><input class="picker-title" aria-label="Picker title" value={picker.current.title} oninput={(event)=>setTitle(event.currentTarget.value)}/></div><Dialog.Root bind:open={editing}><Dialog.Trigger class="settings" aria-label="Edit options"><Settings2/></Dialog.Trigger><Dialog.Portal><Dialog.Overlay class="picker-overlay"/><Dialog.Content class="picker-dialog"><p>Choice set</p><Dialog.Title>Edit options</Dialog.Title><Dialog.Description>Add at least two things worth choosing between.</Dialog.Description><div class="option-add"><input bind:value={draft} placeholder="Another option" onkeydown={(event)=>{if(event.key==="Enter"){event.preventDefault();addOption()}}}/><button type="button" onclick={addOption}><Plus/>Add</button></div><ol>{#each picker.current.options as option (option.id)}<li><input aria-label="Option" value={option.label} oninput={(event)=>updateOption(option.id,event.currentTarget.value)}/><button type="button" aria-label={`Delete ${option.label}`} onclick={()=>removeOption(option.id)}><Trash2/></button></li>{/each}</ol><Dialog.Close class="picker-done">Done</Dialog.Close><Dialog.Close class="picker-close" aria-label="Close"><X/></Dialog.Close></Dialog.Content></Dialog.Portal></Dialog.Root></header>
  <section class="picker-stage"><div class="winner"><span>{spinning?"Shuffling":"Selected"}</span><strong>{winner}</strong><small>{picker.current.options.length} options in the bowl</small></div><button class="pick-button" onclick={choose} disabled={picker.current.options.length===0||spinning}><Dices/>{spinning?"Picking…":"Pick one"}</button></section>
  <footer><div class="option-strip">{#each picker.current.options.slice(0,4) as option}<span>{option.label}</span>{/each}{#if picker.current.options.length>4}<span>+{picker.current.options.length-4}</span>{/if}</div><div class="history"><span>Last</span><strong>{picker.current.history[1]?.label??"—"}</strong></div></footer>
  {#if picker.error}<p class="picker-error">The choices could not be saved.</p>{/if}
</main>
