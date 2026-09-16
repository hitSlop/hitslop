import { resolve } from "node:path";
export const root = resolve(import.meta.dir, "../..");
export const executable = resolve(root, "apps/apple/Packages/HitSlopApple/.build/debug/hitslop-collections-spike");
export class Native {
  readonly process: ReturnType<typeof Bun.spawn>;
  private queue: { resolve(v: any): void; reject(e: Error): void }[] = [];
  constructor(readonly path: string) {
    const child = Bun.spawn([executable, "serve", path], { stdin:"pipe", stdout:"pipe", stderr:"inherit" }); this.process = child;
    void (async () => {
      let buffer = ""; const decoder = new TextDecoder();
      for await (const chunk of child.stdout) {
        buffer += decoder.decode(chunk, {stream:true});
        for (;;) {
          const line = buffer.indexOf("\n"); if (line < 0) break;
          const value = JSON.parse(buffer.slice(0,line)); buffer = buffer.slice(line+1);
          const next = this.queue.shift(); if (!next) throw new Error("Unexpected native response");
          if (value.ok) next.resolve(value.value); else next.reject(new Error(value.error));
        }
      }
      for (const next of this.queue.splice(0)) next.reject(new Error("Native process ended"));
    })();
  }
  request(body: object): Promise<any> {
    return new Promise((resolve,reject) => { this.queue.push({resolve,reject}); (this.process.stdin as any).write(JSON.stringify(body)+"\n"); });
  }
  op(operation: string,args: object = {}) { return this.request({collection:"todos",operation,args}); }
  async close() { (this.process.stdin as any).end(); const code = await this.process.exited; if (code) throw new Error(`Native exit ${code}`); }
}
