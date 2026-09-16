import { join } from "node:path";
import { repository, until } from "../../Prototypes/native-loro-relay/tests/client";

const base = join(repository, ".hitslop/native-loro");
export class Host {
  private callbacks = new Map<string, { resolve(value: any): void; reject(error: Error): void }>();
  private ready = false;
  private tail = "";
  readonly process;
  get ended() { return this.process.exitCode !== null || this.process.signalCode !== null; }
  constructor(readonly directory: string, config?: string, seed?: string, options: string[] = []) {
    const executable = process.env.HITSLOP_SPIKE_EXECUTABLE ?? join(repository, "apps/apple/Packages/HitSlopApple/.build/debug/hitslop-loro-spike");
    this.process = Bun.spawn([executable, "--engine", "native", "--mode", "control", "--package", join(base, "native.slop"), "--document", directory,
      ...(!options.includes("--confirmation") ? ["--confirmation", process.env.HITSLOP_SPIKE_CONFIRMATION ?? "accepted"] : []), ...options, ...(config ? ["--relay-config", config] : []), ...(seed ? ["--seed", seed] : [])], {
      cwd: repository, stdin: "pipe", stdout: "pipe", stderr: Bun.file(directory + ".log"),
    });
    void this.read();
  }
  private async read() {
    const reader = this.process.stdout.getReader(), decoder = new TextDecoder();
    while (true) {
      const { value, done } = await reader.read(); if (done) break;
      this.tail += decoder.decode(value, { stream: true });
      while (this.tail.includes("\n")) {
        const index = this.tail.indexOf("\n"), line = this.tail.slice(0, index); this.tail = this.tail.slice(index + 1);
        let message: any; try { message = JSON.parse(line); } catch { continue; }
        if (message.event === "ready") this.ready = true;
        const waiting = this.callbacks.get(message.id);
        if (waiting) { this.callbacks.delete(message.id); message.error ? waiting.reject(new Error(message.error)) : waiting.resolve(message.value); }
      }
    }
    for (const waiting of this.callbacks.values()) waiting.reject(new Error(`Native process ended: ${this.directory}`));
    this.callbacks.clear();
  }
  async opened() { await until(async () => { if (this.ended) throw new Error(`Native process failed (${this.process.exitCode ?? this.process.signalCode}); ${this.directory}.log`); return this.ready; }, "native window readiness", 45000); return this; }
  call(method: string, values: object = {}): Promise<any> {
    if (this.ended) return Promise.reject(new Error(`Native process ended: ${this.directory}`));
    const id = crypto.randomUUID();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.callbacks.delete(id); reject(new Error(`Native ${method} timed out`)); }, 30000);
      this.callbacks.set(id, { resolve: value => { clearTimeout(timer); resolve(value); }, reject: error => { clearTimeout(timer); reject(error); } });
      this.process.stdin.write(JSON.stringify({ id, method, ...values }) + "\n"); this.process.stdin.flush();
    });
  }
  async edit(script: string) { return this.call("evaluate", { script: `await window.__spikeStore.change(data => { ${script} }); await window.__spikeStore.flush(); return window.__spikeStore.current;` }); }
  async close() { if (!this.ended) { await this.call("close"); await this.process.exited; } }
  async kill() { if (!this.ended) this.process.kill("SIGKILL"); await this.process.exited; }
}
