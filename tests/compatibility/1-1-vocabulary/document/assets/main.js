import {initialize,Document,Session,HostStore,hostCall,fromDescriptor,captureController} from '/__runtime__/index.js';
await initialize();
const config=await hostCall({method:'config'});
const doc=await Document.open(fromDescriptor(await (await fetch('/state.schema.json')).json()),new HostStore(),await (await fetch('/initial.json')).json());
const session=new Session(doc,config.epoch);
const render=()=>document.querySelector('pre').textContent=JSON.stringify(doc.current,null,2);
render();const stop=doc.subscribe(render);
globalThis.__slop={request:r=>session.handle(r),flush:()=>session.flush(),prepareClose:()=>session.prepareClose(),cancelClose:()=>session.cancelClose(),captureBegin:async token=>{await session.flush();return captureController().begin(token,"export")},captureRestore:token=>captureController().restore(token),close:async()=>{stop();await session.close()}};
await hostCall({method:'ready'});
