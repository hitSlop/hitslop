import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import {
  api,
  RelaySocket,
  repository,
  secret,
  sleep,
  token,
  until,
} from "../../Prototypes/native-loro-relay/tests/client";
import { batch } from "../../Prototypes/native-loro-relay/tests/incremental";
import { Host } from "./control-host";

const options = ["--transport", "incremental", "--confirmation", "durable"];
export async function verifyIncrementalE2E(endpoint: string) {
  const label = endpoint.startsWith("https") ? "hosted" : "local";
  const root = join(
    repository,
    `.hitslop/native-loro/results-v4/e2e-${label}-${Date.now()}`,
  );
  await mkdir(root, { recursive: true });
  const checks: { name: string; passed: boolean; details?: unknown }[] = [],
    metrics: Record<string, number> = {};
  const check = (name: string, passed: boolean, details?: unknown) => {
    checks.push({
      name,
      passed,
      ...(details === undefined ? {} : { details }),
    });
    console.log(`${passed ? "PASS" : "FAIL"} ${name}`);
    if (!passed) throw new Error(name);
  };
  const same = (a: any, b: any) => JSON.stringify(a) === JSON.stringify(b);
  const hosts = new Set<Host>(),
    rooms: { id: string; owner: string }[] = [],
    credentials: string[] = [];
  const open = async (
    path: string,
    config?: string,
    seed?: string,
    opts = options,
  ) => {
    const host = new Host(join(root, path), config, seed, opts);
    hosts.add(host);
    return host.opened();
  };
  const key = await secret();
  const credential = async (
    name: string,
    room: string,
    user: string,
    owner = false,
  ) => {
    const path = join(root, name + "-credential.json"),
      value = token(key, room, user, owner);
    await writeFile(path, JSON.stringify({ endpoint, token: value }), {
      mode: 0o600,
    });
    credentials.push(path);
    return path;
  };
  const makeRoom = async (seed: any) => {
    const owner = token(key, seed.documentId, "owner", true);
    await api(endpoint, seed.documentId, owner, "POST", "", {
      protocol: 2,
      ...seed,
    });
    rooms.push({ id: seed.documentId, owner });
    return owner;
  };
  const installSeed = async (room: string, owner: string, name: string) => {
    const reply = await api(endpoint, room, owner, "GET", "/seed");
    if (
      reply.protocol !== 2 ||
      reply.sequence !== 1 ||
      reply.hash !==
        createHash("sha256")
          .update(Buffer.from(reply.snapshot.checkpoint, "base64"))
          .digest("hex")
    )
      throw new Error("Invalid bootstrap response");
    const file = join(root, name + "-seed.json");
    await writeFile(file, JSON.stringify(reply.snapshot));
    return file;
  };
  let result: any;
  try {
    const creator = await open("seed.slop", undefined, undefined, [
      "--confirmation",
      "durable",
    ]);
    const seed = await creator.call("transfer");
    await creator.close();
    const room = seed.documentId,
      owner = await makeRoom(seed),
      seedFile = await installSeed(room, owner, "main");
    await api(endpoint, room, owner, "PUT", "/members/editor");
    await api(endpoint, room, owner, "PUT", "/members/third");
    const ca = await credential("a", room, "owner", true),
      cb = await credential("b", room, "editor"),
      cc = await credential("c", room, "third");
    let a = await open("a.slop", ca, seedFile),
      b = await open("b.slop", cb, seedFile);
    const stats = () => api(endpoint, room, owner, "GET", "/stats");
    const settle = async (list: Host[] = [a, b], timeout = 45000) =>
      until(
        async () => {
          const head = (await stats()).head;
          for (const host of list) {
            if (
              (await host.call("queueCount")) ||
              (await host.call("cursor")) !== head ||
              !(await host.call("status")).ready
            )
              return false;
          }
          return true;
        },
        "durable outboxes and replay cursors settle",
        timeout,
      );
    await a.edit('data.tasks[0].text="Offline branch A";');
    await b.edit('data.tasks[1].text="Offline branch B";');
    const queuedA = await a.call("queue"),
      queuedB = await b.call("queue");
    await a.kill();
    await b.kill();
    a = await open("a.slop", ca);
    b = await open("b.slop", cb);
    check(
      "offline batches retain identical IDs and bytes after force quit",
      same(await a.call("queue"), queuedA) &&
        same(await b.call("queue"), queuedB),
    );
    await a.call("online");
    await b.call("online");
    await settle();
    const merged = (await a.call("frame")).data;
    check(
      "independent offline branches converge through incremental bytes",
      same(merged, (await b.call("frame")).data) &&
        merged.tasks[0].text === "Offline branch A" &&
        merged.tasks[1].text === "Offline branch B",
    );
    check(
      "UI and disk show the same confirmed JSON",
      same(
        merged,
        JSON.parse(
          await readFile(join(root, "a.slop/stores/data.json"), "utf8"),
        ).data,
      ) &&
        same(
          merged,
          await b.call("evaluate", {
            script: "return window.__spikeStore.current;",
          }),
        ),
    );
    let head = (await stats()).head;
    await api(endpoint, room, owner, "POST", "/test", { dropAck: true });
    await a.edit('data.title="Lost ACK";');
    await settle();
    check(
      "lost ACK retries append exactly once",
      (await stats()).head === head + 1 &&
        (await b.call("frame")).data.title === "Lost ACK",
    );
    for (const point of [
      "before-send",
      "after-server-ack",
      "after-outbox-commit",
    ]) {
      await a.call("offline");
      head = (await stats()).head;
      await a.edit(`data.title=${JSON.stringify(point)};`);
      const expected = await a.call("queue");
      await a.call("networkFault", { point });
      await a.call("online").catch(() => {});
      await until(
        async () => a.ended,
        point + " crashes native process",
        45000,
      );
      a = await open("a.slop", ca);
      const recovered = await a.call("queue");
      check(
        `${point}: durable outbox survives the correct boundary`,
        point === "after-outbox-commit"
          ? recovered.length === 0
          : same(expected, recovered),
      );
      await a.call("online");
      await settle();
      check(
        `${point}: reconnect converges without duplicate append`,
        (await stats()).head === head + 1 &&
          (await b.call("frame")).data.title === point,
      );
    }
    await b.call("networkFault", { point: "after-receive-commit" });
    await a.edit('data.title="Receive committed";');
    await until(async () => b.ended, "receive commit crash");
    b = await open("b.slop", cb);
    const committedCursor = await b.call("cursor");
    await b.call("online");
    await settle();
    check(
      "receive commit survives crash before applied ACK",
      committedCursor === (await stats()).head &&
        (await b.call("frame")).data.title === "Receive committed",
    );
    await a.call("offline");
    const file = join(root, "a.slop/stores/data.json"),
      external = JSON.parse(await readFile(file, "utf8"));
    external.data.title = "External JSON delta";
    await writeFile(file, JSON.stringify(external));
    await a.call("flush");
    check(
      "accepted external JSON creates one durable outgoing batch",
      (await a.call("queue")).length === 1,
    );
    await a.call("online");
    await settle();
    check(
      "external JSON reaches the other native view",
      (await b.call("frame")).data.title === "External JSON delta",
    );
    const beforeRestart = await stats();
    await api(endpoint, room, owner, "POST", "/test", { restart: true }).catch(
      () => {},
    );
    await until(
      async () => (await stats()).bootId !== beforeRestart.bootId,
      "object restart",
    );
    await settle();
    await a.edit('data.title="After DO restart";');
    await settle();
    check(
      "Durable Object restart preserves history and resumes delivery",
      (await stats()).head === beforeRestart.head + 1 &&
        (await b.call("frame")).data.title === "After DO restart",
    );
    head = (await stats()).head;
    await sleep(1000);
    check(
      "remote imports do not generate an echo upload",
      (await stats()).head === head &&
        (await a.call("queue")).length === 0 &&
        (await b.call("queue")).length === 0,
    );

    // Same 1,000 durable edits, actual update batches and a full snapshot at every edit.
    await a.call("offline");
    await b.call("offline");
    const workloadStart = performance.now();
    let snapshotBytes = 0;
    for (let start = 0; start < 1000; start += 50) {
      snapshotBytes += (await a.call("workload", { start, count: 50 }))
        .snapshotBytes;
      if (start % 250 === 0) console.log(`Measured ${start + 50}/1000 edits`);
    }
    const batches = await a.call("queue"),
      updateBytes = batches.reduce(
        (sum: number, b: any) => sum + Buffer.from(b.bytes, "base64").length,
        0,
      );
    metrics.workloadMilliseconds = performance.now() - workloadStart;
    metrics.edits = 1000;
    metrics.snapshotUploadBytes = snapshotBytes;
    metrics.incrementalUploadBytes = updateBytes;
    metrics.reductionPercent = 100 * (1 - updateBytes / snapshotBytes);
    check(
      "1000-edit update payload is at least 90% smaller than snapshots",
      batches.length === 1000 && metrics.reductionPercent >= 90,
      metrics,
    );
    const uploadStart = performance.now();
    await a.call("online");
    await b.call("online");
    // Serial durable delivery pays network RTT for every entry. This is a
    // correctness/payload gate; record catch-up time rather than impose a LAN budget.
    await settle([a, b], 600000);
    metrics.workloadSyncMilliseconds = performance.now() - uploadStart;
    check(
      "all 1000 ordered updates replay and drain durably",
      same((await a.call("frame")).data, (await b.call("frame")).data),
    );

    // Grow retained history beyond the single-frame limit without any oversized update.
    for (let start = 0; start < 80; start += 10) {
      await a.call("workload", { start, count: 10, padding: 16000 });
      await settle([a, b], 60000);
    }
    const current = await a.call("transfer");
    metrics.currentSnapshotBytes = Buffer.from(
      current.checkpoint,
      "base64",
    ).length;
    metrics.seedBytes = Buffer.from(seed.checkpoint, "base64").length;
    check(
      "current full snapshot exceeds the 512 KiB message cap",
      metrics.currentSnapshotBytes > 512 * 1024,
    );
    const lateSeed = await installSeed(room, owner, "late");
    check(
      "late join still receives the original small seed",
      JSON.parse(await readFile(lateSeed, "utf8")).checkpoint ===
        seed.checkpoint,
    );
    const c = await open("c.slop", cc, lateSeed),
      bootstrapStart = performance.now();
    await c.call("online");
    await settle([a, b, c], 600000);
    metrics.bootstrapMilliseconds = performance.now() - bootstrapStart;
    metrics.retainedEntries = (await stats()).head;
    metrics.retainedBytes = (await stats()).bytes;
    check(
      "third device reconstructs large history from seed plus every delta",
      same((await a.call("frame")).data, (await c.call("frame")).data),
    );
    await c.close();
    await api(endpoint, room, owner, "POST", "/test", { limit: 0 });
    await b.edit('data.title="Saved during quota";');
    await until(
      async () => (await b.call("status")).paused,
      "quota pauses sharing",
    );
    check(
      "quota keeps a durable local edit and retry batch",
      (await b.call("queue")).length === 1 &&
        JSON.parse(
          await readFile(join(root, "b.slop/stores/data.json"), "utf8"),
        ).data.title === "Saved during quota",
    );
    await api(endpoint, room, owner, "POST", "/test", {
      limit: 64 * 1024 * 1024,
    });
    await b.call("offline");
    await b.call("online");
    await settle();
    check(
      "explicit retry after quota relief drains the same batch",
      (await a.call("frame")).data.title === "Saved during quota",
    );
    await api(endpoint, room, owner, "DELETE", "/members/editor");
    await b.call("offline");
    await b.call("online");
    await sleep(1000);
    await b.edit('data.title="Local after revocation";');
    check(
      "revocation blocks sharing while local saves continue",
      !(await b.call("status")).ready &&
        (await b.call("queue")).length === 1 &&
        JSON.parse(
          await readFile(join(root, "b.slop/stores/data.json"), "utf8"),
        ).data.title === "Local after revocation",
    );
    await a.close();
    await b.close();

    for (const kind of ["malformed", "schema", "missing", "oversized"]) {
      const faultSeed = { ...seed, documentId: crypto.randomUUID() },
        faultOwner = await makeRoom(faultSeed),
        faultRoom = faultSeed.documentId;
      const config = await credential(kind, faultRoom, "owner", true),
        sf = await installSeed(faultRoom, faultOwner, kind);
      let host = await open(kind + ".slop", config, sf);
      const baseline = (await host.call("frame")).data;
      if (kind === "oversized") {
        await host.call("workload", { count: 1, padding: 1000000 });
        const outgoing = await host.call("queue");
        metrics.oversizedDeltaBytes = Buffer.from(
          outgoing[0].bytes,
          "base64",
        ).length;
        check(
          "oversized fixture is a single delta over the cap",
          metrics.oversizedDeltaBytes > 512 * 1024,
        );
        await host.call("online");
        await until(
          async () => (await host.call("status")).paused,
          "oversized pause",
        );
        await host.kill();
        host = await open(kind + ".slop", config);
        check(
          "oversized update stays durably local across restart",
          same(outgoing, await host.call("queue")) &&
            (await api(endpoint, faultRoom, faultOwner, "GET", "/stats"))
              .head === 1,
        );
      } else {
        const invalid =
          kind === "malformed"
            ? batch(Buffer.from("not Loro"))
            : await host.call("invalidBatch", { kind });
        const socket = await RelaySocket.open(
          endpoint,
          faultRoom,
          faultOwner,
          1,
          true,
          { protocol: 2, documentId: faultRoom, schema: seed.schema },
        );
        try {
          await socket.wait("ready");
          socket.send({
            type: "append",
            protocol: 2,
            documentId: faultRoom,
            schema: seed.schema,
            batch: invalid,
          });
          await socket.wait("ack");
        } finally {
          socket.close();
        }
        await host.call("online");
        await until(
          async () => (await host.call("status")).paused,
          kind + " import pauses",
        );
        const error = (await host.call("status")).error;
        check(
          `${kind} authorized-peer bytes preserve state and cursor`,
          same(baseline, (await host.call("frame")).data) &&
            (await host.call("cursor")) === 1,
          { error },
        );
        await host.kill();
        host = await open(kind + ".slop", config);
        check(
          `${kind} rejection leaves checkpoint unchanged after restart`,
          same(baseline, (await host.call("frame")).data) &&
            (await host.call("cursor")) === 1,
        );
      }
      await host.edit('data.title="Local work survives paused sharing";');
      check(
        `${kind} failure allows further durable local work`,
        JSON.parse(
          await readFile(join(root, kind + ".slop/stores/data.json"), "utf8"),
        ).data.title === "Local work survives paused sharing",
      );
      await host.close();
    }
  } catch (error) {
    checks.push({ name: "execution", passed: false, details: String(error) });
    throw error;
  } finally {
    for (const host of hosts) await host.close().catch(() => host.kill());
    for (const room of rooms)
      await api(endpoint, room.id, room.owner, "DELETE").catch((error) =>
        checks.push({ name: "cleanup", passed: false, details: String(error) }),
      );
    for (const path of credentials) await rm(path, { force: true });
    result = {
      endpoint,
      passed: checks.every((c) => c.passed),
      checks,
      metrics,
    };
    await writeFile(
      join(root, "results.json"),
      JSON.stringify(result, null, 2) + "\n",
    );
    console.log(`Incremental native results: ${root}`);
  }
  return result;
}
if (import.meta.main)
  await verifyIncrementalE2E(
    process.env.HITSLOP_SPIKE_ENDPOINT ?? "http://127.0.0.1:8791",
  );
