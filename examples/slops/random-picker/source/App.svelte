<script lang="ts">
  import { Dialog } from "bits-ui";
  import { capture } from "@hitslop/runtime";
  import { jsonStore } from "@hitslop/svelte";
  import Dices from "@lucide/svelte/icons/dices";
  import Plus from "@lucide/svelte/icons/plus";
  import Settings2 from "@lucide/svelte/icons/settings-2";
  import Trash2 from "@lucide/svelte/icons/trash-2";
  import X from "@lucide/svelte/icons/x";
  import Icon from "./Icon.svelte";
  type Option={id:string;label:string};type Pick={id:string;label:string;pickedAt:string};type PickerData={title:string;options:Option[];history:Pick[]};
  const picker=jsonStore<PickerData>({title:"Pick one",options:[],history:[]});
  let editing=$state(false);let draft=$state("");let spinning=$state(false);let display=$state("");let timer:ReturnType<typeof setInterval>|null=null;
  const winner=$derived(display||picker.current.history[0]?.label||"Ready?");
  function addOption():void{const label=draft.trim();if(!label)return;picker.current.options.push({id:crypto.randomUUID(),label});draft=""}
  function removeOption(id:string):void{picker.current.options=picker.current.options.filter((option)=>option.id!==id)}
  function choose():void{if(spinning||picker.current.options.length===0)return;spinning=true;let steps=0;timer=setInterval(()=>{const options=picker.current.options;display=options[Math.floor(Math.random()*options.length)]?.label??"";steps+=1;if(steps<13)return;if(timer)clearInterval(timer);timer=null;const chosen=options[Math.floor(Math.random()*options.length)];if(!chosen){spinning=false;return}display=chosen.label;const pickedAt=new Date().toISOString();picker.current.history.unshift({id:crypto.randomUUID(),label:chosen.label,pickedAt});picker.current.history=picker.current.history.slice(0,5);spinning=false},70)}
</script>

<main class="picker-shell" data-slop-selection="none" data-spinning={spinning}>
  <header><div><span>CHOOSE FOR ME</span><input class="picker-title" aria-label="Picker title" bind:value={picker.current.title}/></div><Dialog.Root bind:open={editing}><Dialog.Trigger class="settings" aria-label="Edit options"><Settings2/></Dialog.Trigger><Dialog.Portal><Dialog.Overlay class="picker-overlay"/><Dialog.Content class="picker-dialog"><p>Choice set</p><Dialog.Title>Edit options</Dialog.Title><Dialog.Description>Add at least two things worth choosing between.</Dialog.Description><div class="option-add"><input bind:value={draft} placeholder="Another option" onkeydown={(event)=>{if(event.key==="Enter"){event.preventDefault();addOption()}}}/><button type="button" onclick={addOption}><Plus/>Add</button></div><ol>{#each picker.current.options as option (option.id)}<li><input aria-label="Option" bind:value={option.label}/><button type="button" aria-label={`Delete ${option.label}`} onclick={()=>removeOption(option.id)}><Trash2/></button></li>{/each}</ol><Dialog.Close class="picker-done">Done</Dialog.Close><Dialog.Close class="picker-close" aria-label="Close"><X/></Dialog.Close></Dialog.Content></Dialog.Portal></Dialog.Root></header>
  <section class="picker-stage"><div class="winner"><span>{spinning?"Shuffling":"Selected"}</span><strong>{winner}</strong><small>{picker.current.options.length} options in the bowl</small></div><button class="pick-button" onclick={choose} disabled={picker.current.options.length===0||spinning}><Dices/>{spinning?"Picking…":"Pick one"}</button></section>
  <footer><div class="option-strip">{#each picker.current.options.slice(0,4) as option}<span>{option.label}</span>{/each}{#if picker.current.options.length>4}<span>+{picker.current.options.length-4}</span>{/if}</div><div class="history"><span>Last</span><strong>{picker.current.history[1]?.label??"—"}</strong></div></footer>
  {#if picker.error}<p class="picker-error">The choices could not be saved.</p>{/if}
</main>

{#if capture.isRenderer()}<Icon />{/if}
