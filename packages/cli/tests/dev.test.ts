import { expect, test } from "bun:test";
import { devHostJavaScript, injectHost } from "../src/dev-bridge.ts";
import { previewShell } from "../src/preview-shell.ts";
import type { WindowSlop } from "../../runtime/src/types";
function preview(data?: unknown) {
  const messages: unknown[] = [];
  const listeners = new Map<string, Function>();
  const window: any = { location: {href: 'http://localhost/'}, addEventListener: (kind: string, callback: Function) => listeners.set(kind, callback), dispatchEvent() {}, ...(data === undefined ? {} : {__hitslopReviewConfig: {data}}) };
  const parent = {postMessage: (value: unknown) => messages.push(value)};
  new Function('window','document','Event','parent','location',devHostJavaScript)(window,{documentElement:{dataset:{}}},Event,parent,{origin:'http://localhost'});
  return {slop: window.slop as WindowSlop, messages, listeners, parent};
}
test('preview shell keeps host chrome outside the document viewport', () => {
  const html = previewShell('/?test=1',320,400);
  expect(html).toContain('_slopFrame=1'); expect(html).toContain('width:320px'); expect(html).toContain('height:400px');
  const injected = injectHost('<html><head></head><body></body></html>',{themeHref:'/assets/theme.css'});
  expect(injected).toContain('data-hitslop-theme-default'); expect(injected).toContain('sync.commit');
});
test('preview has disposable byte storage with generation checks', async () => {
  const {slop} = preview(); const initial = await slop.sync!.open();
  const next = await slop.sync!.commit({expectedGeneration:initial.generation,expectedExternal:null,identity:'YQ==',checkpoint:'Yg==',metadata:'Yw==',projection:'e30=',preserveExternal:false});
  expect(next.external).toBe('e30='); expect(next.externalHash).toHaveLength(64);
  await expect(slop.sync!.commit({expectedGeneration:initial.generation,expectedExternal:null,identity:'YQ==',checkpoint:'Yg==',metadata:'Yw==',preserveExternal:false})).rejects.toThrow('changed');
  expect((await preview().slop.sync!.open()).checkpoint).toBeNull();
});
test('preview reports errors to its parent and retains fixture isolation', async () => {
  const host=preview({count:3});expect(host.slop.preview?.data).toEqual({count:3});
  expect((await host.slop.sync!.open()).external).toBeNull();
  await host.slop.errors.report({instance:'test-runtime',id:'test',revision:1,message:'Failed',details:'Detail',action:'Retry',busy:false,dismissible:false});
  expect(host.messages.at(-1)).toMatchObject({type:'hitslop:errors',reports:[{id:'test',message:'Failed'}]});
  await host.slop.errors.clear({instance:'test-runtime',id:'test',revision:2});expect(host.messages.at(-1)).toMatchObject({reports:[]});
  expect(await host.slop.media.open('hero')).toEqual({exists:false,revision:null});
});
