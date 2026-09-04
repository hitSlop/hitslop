import { afterAll, beforeAll, expect, test } from "bun:test";
import { deleteApp, initializeApp } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { manifestSchemaURL, parseManifest } from "@hitslop/schema";
import { FirebaseRegistryBackend, type FinalizePublishInput } from "../src/backend";

const emulator = process.env.FIRESTORE_EMULATOR_HOST;

if (!emulator) {
  test.skip("Firestore emulator catalog lifecycle", () => {});
} else {
  const app = initializeApp({ projectId: "hitslopapp" }, `catalog-tests-${crypto.randomUUID()}`);
  const firestore = getFirestore(app);
  const bucket = {
    name: "hitslopapp.firebasestorage.app",
    file: () => ({
      exists: async (): Promise<[boolean]> => [false],
      save: async (): Promise<void> => {},
    }),
  };
  const backend = new FirebaseRegistryBackend(firestore, bucket);
  const hash = (character: string): string => character.repeat(64);
  const input = (overrides: Partial<FinalizePublishInput> = {}): FinalizePublishInput => ({
    requestId: "11111111-1111-4111-8111-111111111111",
    publisherKeyId: "publisher-key-id",
    publicKey: "publisher-public-key",
    displayName: "Publisher",
    artifactKey: `artifacts/sha256/${hash("a")}.slop.zip`,
    artifactSha256: hash("a"),
    artifactBytes: 1_024,
    previewKey: `previews/sha256/${hash("b")}.png`,
    previewSha256: hash("b"),
    previewBytes: 512,
    iconKey: `icons/sha256/${hash("c")}.png`,
    iconSha256: hash("c"),
    iconBytes: 256,
    manifest: parseManifest({
      $schema: manifestSchemaURL,
      slug: "counter",
      title: "Counter",
      description: "Count one useful thing.",
      categories: ["utilities"],
      presentation: { width: 360, height: 480 },
    }),
    ...overrides,
  });

  beforeAll(async () => {
    for (const collection of ["publishRequests", "publishers", "releases", "templates"]) {
      await firestore.recursiveDelete(firestore.collection(collection));
    }
  });

  afterAll(async () => {
    for (const collection of ["publishRequests", "publishers", "releases", "templates"]) {
      await firestore.recursiveDelete(firestore.collection(collection));
    }
    await deleteApp(app);
  });

  test("publishes immutable releases, preserves ranking state, and scopes idempotency", async () => {
    const firstInput = input();
    const first = await backend.finalizePublish(firstInput);
    expect(first.releaseNumber).toBe(1);

    const templateRef = firestore.collection("templates").doc(first.templateId);
    const firstTemplate = (await templateRef.get()).data()!;
    expect(firstTemplate.visibility).toBe("public");
    expect(firstTemplate.creationCount).toBe(0);
    expect(firstTemplate.firstPublishedAt).toBeInstanceOf(Timestamp);
    expect(firstTemplate.currentRelease.number).toBe(1);
    expect(firstTemplate.currentRelease.artifact.sha256).toBe(hash("a"));

    expect(await backend.finalizePublish(firstInput)).toEqual(first);
    await expect(backend.finalizePublish({ ...firstInput, artifactSha256: hash("d") }))
      .rejects.toThrow("reused with different content");

    expect(await backend.recordCreation(first.templateId)).toBe(true);
    const counted = (await templateRef.get()).data()!;
    expect(counted.creationCount).toBe(1);

    const second = await backend.finalizePublish(input({
      requestId: "22222222-2222-4222-8222-222222222222",
      artifactKey: `artifacts/sha256/${hash("d")}.slop.zip`,
      artifactSha256: hash("d"),
    }));
    expect(second.releaseNumber).toBe(2);
    const updated = (await templateRef.get()).data()!;
    expect(updated.creationCount).toBe(1);
    expect(updated.firstPublishedAt).toEqual(firstTemplate.firstPublishedAt);
    expect(updated.currentRelease.number).toBe(2);
    expect(updated.currentRelease.artifact.sha256).toBe(hash("d"));

    const releases = await firestore.collection("releases").where("templateId", "==", first.templateId).get();
    expect(releases.size).toBe(2);
    const request = await firestore.collection("publishRequests").doc(`${firstInput.publisherKeyId}_${firstInput.requestId}`).get();
    expect(request.get("expiresAt")).toBeInstanceOf(Timestamp);

    await templateRef.update({ visibility: "hidden" });
    expect(await backend.recordCreation(first.templateId)).toBe(false);
    expect(await backend.recordCreation("missing")).toBe(false);
  });
}
