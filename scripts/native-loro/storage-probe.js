const store=window.__spikeStore;
const bridge=body=>window.webkit.messageHandlers.hitslopNativeSpike.postMessage(body);
const pause=ms=>new Promise(r=>setTimeout(r,ms));
const checks=[];
const check=(name,passed,details={})=>checks.push({name,passed:!!passed,...details});
await store.flush();
const base=structuredClone(store.current);
const field=document.querySelector('textarea[aria-label="Checklist title"]');field.focus();
await bridge({method:'storage',milliseconds:0,failure:'before'});
field.value='Unsaved input retained';field.dispatchEvent(new InputEvent('input',{bubbles:true}));
let failure=false;try {await store.flush();} catch {failure=true;}
await pause(30);
const failed=await bridge({method:'open'});
check('flush reports storage failure',failure && !!failed.error);
check('failed input remains in the field',field.value==='Unsaved input retained',{actual:field.value});
check('publication matches confirmation policy',failed.data.title===(failed.dirty && store.current.title===base.title ? base.title : 'Unsaved input retained'),{current:store.current.title,base:base.title});
// The runner additionally asserts the policy-specific value from this result.
const duringFailure={current:structuredClone(store.current),frame:failed,dom:field.value};
await bridge({method:'storage',milliseconds:0,failure:null});
await store.flush();await pause(30);
check('flush recovers after a rejected edit queue',store.current.title==='Unsaved input retained' && !(await bridge({method:'open'})).dirty);
const stale=structuredClone(await bridge({method:'open'}));stale.publication-=1;stale.data.title='STALE';window.__spikePublish(stale);
check('stale publication ignored',store.current.title==='Unsaved input retained');
const delays=[];
for(const milliseconds of [20,100,500]) {
  await bridge({method:'storage',milliseconds,failure:null});
  const start=performance.now();
  field.focus();
  for(const suffix of ['1','2','3']) {field.value+=suffix;field.dispatchEvent(new InputEvent('input',{bubbles:true}));}
  const immediateDOM=field.value;
  await store.flush();await pause(30);
  check(`typing survives ${milliseconds}ms storage delay`,store.current.title===immediateDOM && field.value===immediateDOM,{actual:store.current.title,expected:immediateDOM});
  delays.push({milliseconds,total_ms:performance.now()-start,maxPending:window.__spikeMetrics.maxPending,pendingAfterFlush:window.__spikeMetrics.pending});
}
await bridge({method:'storage',milliseconds:0,failure:null});
return {checks,passed:checks.every(c=>c.passed),duringFailure,initial:base,delays};
