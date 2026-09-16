import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { Host } from "./control-host";
import { repository } from "../../Prototypes/native-loro-relay/tests/client";

export async function keyboardChecks(policy: string, directory: string) {
  await mkdir(directory,{recursive:true});
  const checks: {name:string;passed:boolean;details?:unknown}[]=[];
  const host=await new Host(join(directory,'keyboard.slop'),undefined,undefined,['--confirmation',policy]).opened();
  const js=(script:string)=>host.call('evaluate',{script});
  const check=(name:string,passed:boolean,details?:unknown)=>checks.push({name,passed,details});
  try {
    const confirmation=await js(`await window.__spikeStore.change(d=>{d.title='Keyboard policy check';});return await window.webkit.messageHandlers.hitslopNativeSpike.postMessage({method:'open'});`);
    check('requested confirmation policy is active',confirmation.dirty===(policy==='accepted'),{dirty:confirmation.dirty,policy});
    await host.call('flush');
    for(const delay of [0,20,100,500]) {
      await js(`await window.webkit.messageHandlers.hitslopNativeSpike.postMessage({method:'delay',phase:'accept',milliseconds:0}); await window.__spikeStore.change(d=>{d.tasks[0].text='abc';});await window.__spikeStore.flush();return true;`);
      await js(`const field=document.querySelector('textarea[aria-label="Task 1"]');field.focus();field.setSelectionRange(3,3);window.__keyboardEvents=[];field.oninput=e=>window.__keyboardEvents.push({trusted:e.isTrusted,value:field.value,inputType:e.inputType});await window.webkit.messageHandlers.hitslopNativeSpike.postMessage({method:'delay',phase:'accept',milliseconds:${delay}});return true;`);
      await host.call('keyboard',{text:'XYZ'});
      const result=await js(`await new Promise(r=>setTimeout(r,50));await window.__spikeStore.flush();await new Promise(r=>setTimeout(r,30)); const field=document.querySelector('textarea[aria-label="Task 1"]');return {current:window.__spikeStore.current.tasks[0].text,dom:field.value,selection:field.selectionStart,events:window.__keyboardEvents};`);
      check(`native keyboard burst at ${delay}ms`,result.current==='abcXYZ'&&result.dom===result.current&&result.selection===6&&result.events.length===3&&result.events.every((e:any)=>e.trusted),result);
    }
    await js(`await window.webkit.messageHandlers.hitslopNativeSpike.postMessage({method:'delay',phase:'accept',milliseconds:0});const f=document.querySelector('textarea[aria-label="Task 1"]');f.focus();f.setSelectionRange(1,3);return true;`);
    await host.call('keyboard',{text:'Q'});
    const replaced=await js(`await new Promise(r=>setTimeout(r,50));await window.__spikeStore.flush();return window.__spikeStore.current.tasks[0].text;`);
    check('native keyboard replaces selection',replaced==='aQXYZ',{actual:replaced});
    // WebKit may coalesce the preceding typing and replacement into one undo group.
    const undo=await host.call('history');
    const undone=await js(`await new Promise(r=>setTimeout(r,50));await window.__spikeStore.flush();return window.__spikeStore.current.tasks[0].text;`);
    const redo=await host.call('history',{redo:true});
    const redone=await js(`await new Promise(r=>setTimeout(r,50));await window.__spikeStore.flush();return window.__spikeStore.current.tasks[0].text;`);
    check('native editor undo and redo',undo.available&&redo.available&&['abc','abcXYZ'].includes(undone)&&redone===replaced,{undo,redo,undone,redone});
    await host.call('keyboard',{text:'\u007f'});
    const deleted=await js(`await new Promise(r=>setTimeout(r,50));await window.__spikeStore.flush();return window.__spikeStore.current.tasks[0].text;`);
    check('native keyboard backspace',deleted==='aXYZ',{actual:deleted});
    await host.call('screenshot',{path:join(directory,'keyboard.png')});
    await host.call('reload');
    check('keyboard edits survive renderer reload',await js(`return window.__spikeStore.current.tasks[0].text;`)===deleted);
  } finally {await host.close().catch(()=>host.kill());}
  // Installed sources are evidence of availability, not a claim that synthetic
  // composition events exercised an OS input method.
  const inputSources=await Bun.$`defaults read com.apple.HIToolbox AppleEnabledInputSources`.quiet().nothrow().text();
  const result={checks,passed:checks.every(c=>c.passed),systemIME:{status:'unverified',inputSources,required:'Manual system IME composition with concurrent remote editing before a production migration.'}};
  await writeFile(join(directory,'keyboard.json'),JSON.stringify(result,null,2)+'\n');
  return result;
}
if(import.meta.main) console.log(JSON.stringify(await keyboardChecks(process.env.HITSLOP_SPIKE_CONFIRMATION??'accepted',join(repository,'.hitslop/native-loro/results-v3/keyboard-manual'))));
