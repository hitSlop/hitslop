import { test, expect } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import identity from "../../document/src/runtime-identity.json";
import {
  catalog,
  verifyCopies,
  verifyReleasedIdentities,
  releases,
  verifyStorageDecision,
} from "../../../scripts/v1/runtime-artifacts";

test("runtime catalogs compare complete contract sets and bytes per contract", async () => {
  const root = await mkdtemp(join(tmpdir(), "runtime-catalog-"));
  const consumers = [join(root, "host"), join(root, "helper")];
  async function add(consumer: string, contract: number) {
    const folder = join(consumer, String(contract));
    await mkdir(join(folder, "loro"), { recursive: true });
    await writeFile(
      join(folder, "identity.json"),
      JSON.stringify({
        runtimeContract: contract,
        runtimeRevision: 1,
        storageRevision: 1,
        sdkVersion: "1",
        loroVersion: "1",
        protocolVersion: 1,
      }),
    );
    for (const file of [
      "index.js",
      "boot.js",
      "headless.js",
      "loro/index.js",
      "loro/loro_wasm_bg.wasm",
    ])
      await writeFile(join(folder, file), `contract ${contract}`);
  }
  try {
    for (const consumer of consumers) for (const contract of [3]) await add(consumer, contract);
    await verifyCopies(consumers);
    await writeFile(join(consumers[1]!, "3/index.js"), "drift");
    await expect(verifyCopies(consumers)).rejects.toThrow("differ");
    await add(consumers[1]!, 3);
    await add(consumers[1]!, 4);
    await expect(verifyCopies(consumers)).rejects.toThrow("exactly one");
    await rm(join(consumers[0]!, "3/headless.js"));
    await expect(catalog(consumers[0]!)).rejects.toThrow();
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("changed Loro pins require an explicit storage compatibility decision", () => {
  const previous = [
    {
      runtimeContract: 3,
      runtimeRevision: 1,
      storageRevision: 1,
      loroVersion: "1.16.1",
      sha256: "a".repeat(64),
    },
  ];
  const candidate = {
    ...previous[0]!,
    runtimeRevision: 2,
    loroVersion: "1.17.0",
    sdkVersion: "3.0.0",
    protocolVersion: 1,
  };
  expect(() => verifyStorageDecision(candidate, previous, [])).toThrow("storage-revision decision");
  const decision = {
    runtimeContract: 3,
    runtimeRevision: 2,
    fromLoroVersion: "1.16.1",
    toLoroVersion: "1.17.0",
    storageRevision: 1,
    reason: "Same-storage historical replay preserves exact values and identities.",
  };
  verifyStorageDecision(candidate, previous, [decision]);
  expect(() =>
    verifyStorageDecision({ ...candidate, storageRevision: 2 }, previous, [decision]),
  ).toThrow();
  expect(() => verifyStorageDecision(candidate, previous, [{ ...decision, reason: "" }])).toThrow();
});

test("released contracts cannot disappear, regress or silently change bytes", async () => {
  const published = [
    {
      runtimeContract: 3,
      runtimeRevision: 1,
      storageRevision: 1,
      // This case owns release seals, not a change of engine pin.
      loroVersion: identity.loroVersion,
      sha256: "a".repeat(64),
    },
  ];
  const values: Awaited<ReturnType<typeof catalog>> = {};
  for (const release of published)
    values[String(release.runtimeContract)] = {
      identity: { ...release, sdkVersion: "1", protocolVersion: 1 },
      sha256: release.sha256,
    };
  await verifyReleasedIdentities(values, published);
  const first = published[0]!;
  values[String(first.runtimeContract)]!.sha256 = "0".repeat(64);
  await expect(verifyReleasedIdentities(values, published)).rejects.toThrow(
    "increment runtimeRevision",
  );
  delete values[String(first.runtimeContract)];
  await expect(verifyReleasedIdentities(values, published)).rejects.toThrow("removed");
});
