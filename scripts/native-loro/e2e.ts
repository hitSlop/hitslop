import { mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { api, artifacts, repository, secret, sleep, token, until } from "../../Prototypes/native-loro-relay/tests/client";

import { Host } from "./control-host";

export async function verifyE2E(endpoint: string, interactive = false) {
  const label = endpoint.startsWith("https") ? "hosted" : "local";
  const root = join(process.env.HITSLOP_SPIKE_RESULTS ?? artifacts, `e2e-${label}-${Date.now()}`); await mkdir(root, { recursive: true });
  const paths = [join(root, "a.slop"), join(root, "b.slop")];
  const checks: { name: string; passed: boolean; details?: any }[] = [];
  const timings: { action: string; milliseconds: number }[] = [];
  const check = (name: string, passed: boolean, details?: any) => { checks.push({ name, passed, ...(details ? { details } : {}) }); if (!passed) throw new Error(name); };
  const key = await secret(); let a: Host | undefined, b: Host | undefined, room = "", owner = "", created = false;
  const same = (a: any, b: any) => JSON.stringify(a) === JSON.stringify(b);
  try {
    a = await new Host(paths[0]).opened(); const seed = await a.call("transfer"); room = seed.documentId; owner = token(key, room, "owner", true);
    const seedFile = join(root, "seed.json"); await writeFile(seedFile, JSON.stringify(seed));
    const configA = join(root, "a-credential.json"), configB = join(root, "b-credential.json");
    await writeFile(configA, JSON.stringify({ endpoint, token: owner }), { mode: 0o600 });
    await writeFile(configB, JSON.stringify({ endpoint, token: token(key, room, "editor") }), { mode: 0o600 });
    await api(endpoint, room, owner, "POST", "", seed); created = true; await api(endpoint, room, owner, "PUT", "/members/editor");
    await a.close(); a = await new Host(paths[0], configA).opened(); b = await new Host(paths[1], configB, seedFile).opened();
    check("shared seed opens offline in independent processes", same((await a.call("frame")).data, (await b.call("frame")).data));
    await a.call("online"); await b.call("online");
    await until(async () => (await a!.call("status")).ready && (await b!.call("status")).ready, "both clients online");
    if (interactive) {
      console.log(`Two native checklist windows connected to ${endpoint}. Close this command to end the session.`);
      await new Promise<void>(resolve => { process.once("SIGINT", resolve); process.once("SIGTERM", resolve); });
      return checks;
    }
    const start = performance.now();
    await a.edit('data.tasks[0].text = "Live A";');
    await until(async () => (await b!.call("frame")).data.tasks[0].text === "Live A", "remote edit arrives");
    timings.push({ action: "local edit to remote canonical state", milliseconds: performance.now() - start });
    await b.edit('data.tasks[1].done = true;');
    await until(async () => (await a!.call("frame")).data.tasks[1].done, "reverse direction");
    check("two-way native WebSocket synchronization", true);
    await a.call("offline"); await b.call("offline");
    const head = (await api(endpoint, room, owner, "GET", "/stats")).head;
    await a.edit('data.tasks[0].text = "Offline A";'); await b.edit('data.tasks[1].text = "Offline B";');
    await a.kill(); await b.kill();
    a = await new Host(paths[0], configA).opened(); b = await new Host(paths[1], configB).opened();
    check("flushed unsynced edits survive forced process termination", (await a.call("frame")).data.tasks[0].text === "Offline A" && (await b.call("frame")).data.tasks[1].text === "Offline B");
    await a.edit('data.title = "Reopened offline";'); await b.edit('data.tasks[2].done = true;');
    check("offline reopening and further editing do not contact relay", (await api(endpoint, room, owner, "GET", "/stats")).head === head);
    await a.call("online"); await b.call("online");
    await until(async () => {
      const x = (await a!.call("frame")).data, y = (await b!.call("frame")).data;
      return same(x, y) && x.tasks[0].text === "Offline A" && x.tasks[1].text === "Offline B" && x.tasks[2].done && x.title === "Reopened offline";
    }, "offline branches converge", 25000);
    check("offline branches converge after restart and reconnect", true);
    await a.call("flush"); await b.call("flush");
    const canonical = (await a.call("frame")).data;
    check("canonical UI and both JSON files converge", same(JSON.parse(await readFile(join(paths[0], "stores/data.json"), "utf8")).data, canonical)
      && same(JSON.parse(await readFile(join(paths[1], "stores/data.json"), "utf8")).data, canonical)
      && same(await a.call("evaluate", { script: "return window.__spikeStore.current;" }), canonical)
      && same(await b.call("evaluate", { script: "return window.__spikeStore.current;" }), canonical));
    await a.call("offline");
    const file = join(paths[0], "stores/data.json"), external = JSON.parse(await readFile(file, "utf8"));
    await a.edit('data.tasks[0].done = false;'); external.data.title = "External file edit";
    await writeFile(file, JSON.stringify(external)); await a.call("flush");
    check("historical external JSON retains pending UI changes", (await a.call("frame")).data.title === "External file edit" && !(await a.call("frame")).data.tasks[0].done);
    await a.call("online");
    await until(async () => (await a!.call("status")).ready, "sharing before malformed projection");
    const validFile = await readFile(file, "utf8"); await writeFile(file, "{unfinished");
    await a.edit('data.tasks[2].archived = true;');
    check("malformed external JSON is preserved while native edits save", await readFile(file, "utf8") === "{unfinished" && (await a.call("frame")).projectionError !== null);
    await until(async () => (await b!.call("frame")).data.tasks[2].archived, "sharing despite malformed projection");
    check("sharing stays usable during an external JSON error", await readFile(file, "utf8") === "{unfinished");
    await writeFile(file, validFile); await a.call("flush");
    check("repairing projection rematerializes latest checkpoint", JSON.parse(await readFile(file, "utf8")).data.tasks[2].archived === true);
    await a.call("online"); await until(async () => (await b!.call("frame")).data.tasks[2].archived, "external/native changes reach peer");
    await api(endpoint, room, owner, "POST", "/test", { dropAck: true });
    await a.edit('data.title = "Lost acknowledgement recovered";');
    await until(async () => (await b!.call("frame")).data.title === "Lost acknowledgement recovered" && (await a!.call("status")).ready, "lost ack retry", 25000);
    check("lost upload acknowledgement recovers without data loss", true);
    await a.call("detach"); await b.edit('data.title = "Renderer detached";');
    await until(async () => (await a!.call("frame")).data.title === "Renderer detached", "native sync without renderer");
    check("sharing continues after renderer detaches", true);
    const restartBefore = await api(endpoint, room, owner, "GET", "/stats");
    await api(endpoint, room, owner, "POST", "/test", { restart: true }).catch(() => {});
    await until(async () => (await api(endpoint, room, owner, "GET", "/stats")).bootId !== restartBefore.bootId && (await a!.call("status")).ready && (await b!.call("status")).ready, "object restart and native reconnect", 25000);
    await b.edit('data.title = "Object restarted";');
    await until(async () => (await a!.call("frame")).data.title === "Object restarted", "delivery after object restart");
    check("native clients reconnect after Durable Object restart", true);
    if (label === "hosted") {
      await until(async () => !(await a!.call("status")).pending && !(await b!.call("status")).pending, "uploads settled");
      const before = await api(endpoint, room, owner, "GET", "/stats");
      await sleep(16000);
      const after = await api(endpoint, room, owner, "GET", "/stats");
      checks.push({ name: "hosted idle wake observation", passed: true, details: { before, after, hibernationObserved: before.bootId !== after.bootId && after.connections === before.connections && after.connections === 2 } });
      await b.edit('data.title = "After hosted idle";');
      await until(async () => (await a!.call("frame")).data.title === "After hosted idle", "after idle sync");
      check("hosted sockets deliver after idle", true);
    }
    await api(endpoint, room, owner, "POST", "/test", { limit: 0 });
    await b.edit('data.title = "Saved despite quota";');
    await until(async () => String((await b!.call("status")).error).includes("storage limit"), "quota pauses sharing");
    check("quota failure leaves native saving usable", JSON.parse(await readFile(join(paths[1], "stores/data.json"), "utf8")).data.title === "Saved despite quota");
    await api(endpoint, room, owner, "DELETE", "/members/editor");
    await b.call("offline"); await b.call("online"); await sleep(1500);
    await b.edit('data.title = "Saved after revocation";');
    check("revoked client retains local edits", !(await b.call("status")).ready && JSON.parse(await readFile(join(paths[1], "stores/data.json"), "utf8")).data.title === "Saved after revocation");
    await b.call("screenshot", { path: join(root, "b.png") });
    await b.call("reload");
    check("reloaded renderer shows native state", await b.call("evaluate", { script: 'return document.querySelector("textarea[aria-label=\\"Checklist title\\"]").value;' }) === "Saved after revocation");
    const runtime = await b.call("evaluate", { script: 'return {wasm:window.__spikeWasmCalls,resources:performance.getEntriesByType("resource").filter(r=>r.name.includes("document-runtime-")).length};' });
    check("native webviews never load a CRDT engine", runtime.wasm === 0 && runtime.resources === 0);
    const statuses = [await a.call("status"), await b.call("status")];
    await writeFile(join(root, "network.json"), JSON.stringify({ statuses, stats: await api(endpoint, room, owner, "GET", "/stats") }, null, 2));
  } catch (error) {
    checks.push({ name: "execution", passed: false, details: String(error) }); throw error;
  } finally {
    await a?.close().catch(() => a?.kill()); await b?.close().catch(() => b?.kill());
    if (created) await api(endpoint, room, owner, "DELETE").catch(error => checks.push({ name: "cleanup", passed: false, details: String(error) }));
    for (const name of ["a-credential.json", "b-credential.json"]) await rm(join(root, name), { force: true });
    await writeFile(join(root, "results.json"), JSON.stringify({ endpoint, passed: checks.every(c => c.passed), checks, timings }, null, 2));
    console.log(`Native end-to-end results: ${root}`);
  }
  return checks;
}
if (import.meta.main) console.log(JSON.stringify(await verifyE2E(process.env.HITSLOP_SPIKE_ENDPOINT ?? "http://127.0.0.1:8791", process.argv.includes("--open-pair"))));
