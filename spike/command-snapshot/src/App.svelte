<script lang="ts">
  import { onDestroy, tick } from "svelte";
  import { Tabs } from "bits-ui";
  import Checklist from "./checklist/Checklist.svelte";
  import { createDemo, type Client } from "./demo.svelte.ts";
  import { counterPaths, schema } from "./checklist-schema.ts";
  import { Authority, MockHost } from "./host.ts";
  import { documentStore } from "./document-store.svelte.ts";
  import { fields, initial } from "./checklist-schema.ts";
  import type { Op } from "./protocol.ts";
  import * as s from "./harness.css.ts";

  const demo = createDemo();
  let latency = $state("0");
  let armed = $state<Record<string, string>>({});
  let flushNotice = $state<Record<string, string>>({});
  let measuring = $state(false), measurement = $state("");
  let benchStore = $state.raw<ReturnType<typeof documentStore<typeof schema>> | null>(null);
  function setLatency(value: string) {
    latency = value;
    for (const client of demo.clients) client.host.latency = client.counterHost.latency = Number(value);
  }
  function connect(client: Client) {
    client.host.setConnected(!client.host.connected);
    client.counterHost.setConnected(client.host.connected);
  }
  function arm(client: Client, type: "reject" | "ack") {
    if (type === "reject") client.host.rejectNext = true;
    else client.host.dropAckNext = true;
    armed[client.name] = type === "reject" ? "Next checklist command will be rejected." : "Next checklist acknowledgement will be lost.";
  }
  async function flush(client: Client) {
    client.store.clearError();
    const result = await client.store.flush();
    flushNotice[client.name] = result.ok ? `All drafts confirmed at revision ${result.revision}.` : result.error.message;
  }
  async function benchmark(rows = 1000, samples = 12) {
    const data = { ...initial, tasks: Array.from({ length: rows }, (_, i) => ({ id: `row-${i}`, text: `Synthetic task ${i}`, done: false, archived: false })) };
    const authority = new Authority(schema, data), host = new MockHost(authority, "benchmark");
    const store = documentStore({ schema, initial: data, host });
    benchStore = store; await store.ready; await tick();
    const times: number[] = [];
    for (let i = 0; i < samples + 3; i++) {
      const start = performance.now();
      await store.set(fields.tasks.item(`row-${rows - 1}`).done, i % 2 === 0);
      await tick();
      if (i >= 3) times.push(performance.now() - start);
    }
    const sorted = times.sort((a, b) => a - b);
    const result = { rows, bytes: new TextEncoder().encode(JSON.stringify(data)).length, samples,
      commandToDOMMedianMs: sorted[Math.floor(sorted.length / 2)]!, p95Ms: sorted[Math.ceil(sorted.length * .95) - 1]! };
    benchStore = null; store.dispose(); host.dispose(); return result;
  }
  async function measure() {
    measuring = true;
    try { const results = []; for (const rows of [1000, 5000, 10000]) results.push(await benchmark(rows)); measurement = JSON.stringify(results, null, 2); }
    catch (error) { measurement = String(error); }
    finally { measuring = false; }
  }
  // Explicit local test surface. It uses the real authority and store, never a second model.
  window.spike = { demo, benchmark, async ready() { await Promise.all(demo.clients.map(c => c.store.ready)); },
    remote(ops: Op[]) { return demo.authority.execute({ requestId: crypto.randomUUID(), ops }); } };
  onDestroy(() => { demo.dispose(); delete window.spike; });
</script>

<main class={s.board}>
  <header class={s.intro}>
    <div><h1 class={s.title}>Commands up. Snapshots down.</h1>
      <p class={s.description}>Two independent views of one checklist. Try editing both, interrupting a request, or typing while the other view changes. Everything here is disposable.</p></div>
    <span class={s.status}>TypeScript spike · in memory</span>
  </header>
  <div class={s.toolbar}>
    <span class={s.label}>Simulated round-trip</span>
    <Tabs.Root value={latency} onValueChange={setLatency}>
      <Tabs.List class={s.latency} aria-label="Simulated round-trip latency">
        {#each [0, 50, 150, 400] as ms}<Tabs.Trigger class={s.button} value={String(ms)}>{ms} ms</Tabs.Trigger>{/each}
      </Tabs.List>
    </Tabs.Root>
    <span class={s.status}>0 ms adds no artificial delay. It does not measure Swift.</span>
  </div>
  <div class={s.columns}>
    {#each demo.clients as client}
      <section class={s.client} aria-label={`Client ${client.name}`}>
        <header class={s.clientHeader}>
          <h2 class={s.clientTitle}>Client {client.name}</h2>
          <span class={s.status} data-testid={`status-${client.name}`} aria-live="polite">{client.store.connected ? "Connected" : "Offline · read only"} · r{client.store.revision}{client.store.pending ? ` · ${client.store.pending} pending` : ""}</span>
        </header>
        <div class={s.frame}><Checklist {client} /></div>
        <div class={s.controls}>
          <button class={s.button} onclick={() => connect(client)}>{client.store.connected ? "Disconnect" : "Reconnect"}</button>
          <button class={s.button} disabled={!client.store.canWrite} onclick={() => arm(client, "reject")}>Reject next</button>
          <button class={s.button} disabled={!client.store.canWrite} onclick={() => arm(client, "ack")}>Lose next ack</button>
          <button class={s.button} disabled={!client.store.connected} onclick={() => flush(client)}>Flush drafts</button>
        </div>
        <p class={s.fault} aria-live="polite">{armed[client.name] && client.store.pending === 0 && (client.host.rejectNext || client.host.dropAckNext) ? armed[client.name] : flushNotice[client.name] ?? ""}</p>
        <div class={s.counter}>
          <span>Shared counter</span><output class={s.count}>{client.counter.data.count}</output>
          <button class={s.button} disabled={!client.counter.canWrite} onclick={() => client.counter.increment(counterPaths.count)}>Increment</button>
          <span class={s.status}>{client.counter.pending ? `${client.counter.pending} pending` : "Try both at once"}</span>
        </div>
        {#each client.store.retainedDrafts as draft (draft.id)}
          <div class={s.recovery} role="alert">
            <strong>Unsaved text retained</strong><p class={s.fine}>{draft.path}</p>
            <div class={s.retainedText}>{draft.value}</div>
            <div class={s.controls}>
              <button class={s.button} onclick={() => client.store.retryDraft(draft.id)}>Retry text</button>
              <button class={s.button} onclick={() => { client.store.discardDraft(draft.id); client.store.clearError(); }}>Discard draft</button>
            </div>
          </div>
        {/each}
      </section>
    {/each}
  </div>
  <footer class={s.footer}>
    <strong>What this proves</strong><br />Typed paths, atomic commands, confirmed snapshots, text drafts, and request retries. No Loro, native disk writes, real network, or optimistic document replica.
    <div class={s.tools}><button class={s.button} onclick={measure} disabled={measuring}>{measuring ? "Measuring…" : "Measure browser updates"}</button><span class={s.status}>1k / 5k / 10k synthetic rows; 1 MiB cap</span></div>
    {#if measurement}<pre class={s.measurement}>{measurement}</pre>{/if}
    {#if benchStore}<output data-testid="benchmark-output">r{benchStore.revision} · {benchStore.data.tasks.filter(t => t.done).length} done</output>{/if}
  </footer>
</main>
