// Evaluated only by the isolated native harness, in a real WKWebView.
const store = window.__spikeStore;
const bridge = body => window.webkit.messageHandlers.hitslopNativeSpike.postMessage(body);
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const until = async predicate => { const end = performance.now()+5000; while (!await predicate()) { if(performance.now()>end) throw new Error('Probe timed out'); await pause(2); } };
const checks = [];
const check = (name, passed, details = {}) => checks.push({name, passed:!!passed, ...details});
const settle = async () => { await store.flush(); await pause(30); };
const input = (field, value) => { field.value=value; field.setSelectionRange(value.length,value.length); field.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertText'})); };
const reset = async () => {
  await bridge({method:'delay',milliseconds:0,phase:'accept'}); await bridge({method:'delay',milliseconds:0});
  await store.change(data=>{data.tasks[0].text='abc';}); await settle();
  const field = document.querySelector('textarea[aria-label="Task 1"]'); field.focus(); return field;
};
// Deliberately do not wait for native acceptance between input events.
for (const delay of [0,20,100,500]) {
  const field = await reset();
  await bridge({method:'delay',milliseconds:delay,phase:'accept'});
  input(field,'abcX'); input(field,'abcXY'); input(field,'abcXYZ');
  const beforeAck = { dom:field.value, current:store.current.tasks[0].text, pending:window.__spikeMetrics.pending };
  await settle();
  const actual=store.current.tasks[0].text;
  check(`three inputs before acknowledgement at ${delay}ms`,actual==='abcXYZ' && field.value===actual && beforeAck.pending===3,
    {expected:'abcXYZ',actual,beforeAck,trace:window.__spikeMetrics.trace.slice(-24)});
  if(window.__spikeTextPolicy==='host-frame' && !checks.at(-1).passed) {
    return {checks,passed:false,rejectedAt:'correctness screen; no benchmark',metrics:window.__spikeMetrics};
  }
}
for (const delay of [0,20,100,500]) {
  for (const position of ['before-acceptance','before-reply','composition']) {
    const field=await reset(), id=store.current.tasks[0].id;
    await bridge({method:'delay',milliseconds:delay,phase:position==='before-acceptance'?'accept':'reply'});
    if(position==='composition') field.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true}));
    input(field,'abcX');
    if(position==='before-reply') await until(async()=>(await bridge({method:'open'})).data.tasks[0].text==='abcX');
    const remoteFrame=await bridge({method:'open'}), remote=remoteFrame.data;
    remote.tasks.find(t=>t.id===id).text='R'+remote.tasks.find(t=>t.id===id).text;
    await bridge({method:'remote',base:remoteFrame.revision,after:remote});
    input(field,field.value+'Y'); input(field,field.value+'Z');
    if(position==='composition') field.dispatchEvent(new CompositionEvent('compositionend',{bubbles:true,data:'abcXYZ'}));
    await settle();
    const actual=store.current.tasks.find(t=>t.id===id).text;
    check(`remote ${position} at ${delay}ms`,actual==='RabcXYZ',{expected:'RabcXYZ',actual});
  }
}
// Selection replacement/paste, deletion, history-shaped replacement and blur.
for(const [name,from,to,value,expected] of [
  ['paste selection',1,2,'😀','a😀c'], ['delete selection',1,2,'','ac'],
  ['whole replacement',0,3,'replacement','replacement'],
]) {
  const field=await reset(); field.setSelectionRange(from,to);
  field.setRangeText(value,from,to,'end');
  field.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:name.includes('delete')?'deleteContentBackward':'insertFromPaste'}));
  const selection=field.selectionStart; field.blur(); await settle();
  check(name,store.current.tasks[0].text===expected && field.value===expected,{actual:field.value,selection});
}
await bridge({method:'delay',milliseconds:0,phase:'accept'});await bridge({method:'delay',milliseconds:0});
// Mutators run exactly once and the public store hides protocol internals.
let calls=0;await Promise.all([store.change(data=>{calls++;data.tasks[0].done=!data.tasks[0].done;}),store.change(data=>{calls++;data.tasks[0].done=!data.tasks[0].done;})]);
check('mutators execute once',calls===2,{calls});
check('public API hides draft protocol',!('frame' in store)&&!('createDraft' in store)&&!('releaseDraft' in store));
await settle();
return {checks,passed:checks.every(c=>c.passed),metrics:window.__spikeMetrics};
