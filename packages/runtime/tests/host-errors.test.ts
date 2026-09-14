import { expect, test } from 'bun:test';
import { errors, performHostAction } from '../src/host-errors';
import type { BridgeParams } from '@hitslop/schema/bridge';
const settle = () => new Promise(resolve => setTimeout(resolve, 0));
test('host reports reject stale actions and duplicate clicks without clearing newer errors', async () => {
  const previous = globalThis.window;
  const reports: BridgeParams<'errors.report'>[] = []; const cleared: string[]=[];
  (globalThis as any).window = {slop:{errors:{report:async (value: BridgeParams<'errors.report'>)=>{reports.push(value);},clear:async (value:any)=>{cleared.push(value.id);}}}};
  try {
    let finish!:()=>void;let calls=0;
    errors.report({id:'save',message:'Unsaved',dismissible:false,action:{label:'Retry',run:async()=>{calls++;await new Promise<void>(resolve=>finish=resolve);}}});
    await settle();const first=reports.at(-1)!;
    expect(await performHostAction('save',first.revision,first.instance,true)).toBe(false);
    const pending=performHostAction('save',first.revision,first.instance);
    expect(await performHostAction('save',first.revision,first.instance)).toBe(false);expect(calls).toBe(1);
    errors.report({id:'save',message:'New failure'});await settle();finish();await pending;await settle();
    expect(cleared).not.toContain('save');expect(await performHostAction('save',first.revision,first.instance)).toBe(false);
    expect(await performHostAction('save',reports.at(-1)!.revision,reports.at(-1)!.instance,true)).toBe(true);
    await settle();expect(cleared).toEqual(['save']);
  } finally { (globalThis as any).window=previous; }
});
test('failed recovery remains visible and can be retried', async () => {
  const previous=globalThis.window;let report: BridgeParams<'errors.report'>;let attempts=0;let clear=false;
  (globalThis as any).window={slop:{errors:{report:async(value:any)=>{report=value;},clear:async()=>{clear=true;}}}};
  try {
    errors.report({id:'retry',message:'Failed',action:{label:'Retry',run:async()=>{if(++attempts===1)throw new Error('still offline');}}});
    await settle();expect(await performHostAction('retry',report!.revision,report!.instance)).toBe(false);await settle();
    expect(report!.details).toBe('still offline');expect(report!.busy).toBe(false);expect(clear).toBe(false);
    expect(await performHostAction('retry',report!.revision,report!.instance)).toBe(true);await settle();expect(clear).toBe(true);
  } finally {(globalThis as any).window=previous;}
});
