import {test,expect} from 'bun:test';
import {compileModule} from 'svelte/compiler';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {installHost} from '@hitslop/runtime';
Bun.plugin({name:'media-runes',setup(build){
  build.onResolve({filter:/^svelte$/},()=>({path:resolve(dirname(fileURLToPath(import.meta.resolve('svelte/package.json'))),'src/index-client.js')}));
  build.onLoad({filter:/media-store\.svelte\.ts$/},async({path})=>({contents:compileModule(new Bun.Transpiler({loader:'ts'}).transformSync(await Bun.file(path).text()),{filename:path,generate:'client'}).js.code,loader:'js'}));
}});
test('media failures retain the latest operation for host retry through destruction', async()=>{
  const old=globalThis.window;const reports:any[]=[];let fail=true;let removed=0;
  (globalThis as any).window={location:{href:'http://localhost/'},slop:{errors:{report:async(value:any)=>{reports.push(value);},clear:async()=>{}}}};
  const uninstall=installHost({mediaOpen:async()=>({exists:false,revision:null}),mediaWrite:async()=>({revision:'one'}),mediaRemove:async()=>{if(fail)throw new Error('Disk failed');removed++;return {revision:null};},resizeWindow:async size=>size,dragWindow:async()=>{},watch:()=>()=>{}});
  const {MediaStore}=await import('../src/media-store.svelte.ts');
  const store=new MediaStore('attachment',null,'*/*');
  try {
    await store.reload();await expect(store.remove()).rejects.toThrow('Disk failed');
    await new Promise(resolve=>setTimeout(resolve,0));expect(reports.at(-1).message).toBe('Could not save attachment');
    store.destroy();fail=false;await store.flush();expect(removed).toBeGreaterThan(0);
  }finally{uninstall();await new Promise(resolve=>setTimeout(resolve,0));(globalThis as any).window=old;}
});
