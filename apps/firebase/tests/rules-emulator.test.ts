import { afterAll, beforeAll, beforeEach, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { initializeTestEnvironment, assertFails, assertSucceeds, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc } from "firebase/firestore";

const emulator = process.env.FIRESTORE_EMULATOR_HOST;

if (!emulator) {
  test.skip("Firestore public catalog rules", () => {});
} else {
  let environment: RulesTestEnvironment;

  beforeAll(async () => {
    const [host, port] = emulator.split(":");
    environment = await initializeTestEnvironment({
      projectId: "hitslopapp",
      firestore: {
        host,
        port: Number(port),
        rules: await readFile(new URL("../firestore.rules", import.meta.url), "utf8"),
      },
    });
  });

  beforeEach(async () => {
    await environment.clearFirestore();
    await environment.withSecurityRulesDisabled(async (context) => {
      const firestore = context.firestore();
      await Promise.all([
        setDoc(doc(firestore, "templates/public-template"), { visibility: "public", title: "Public" }),
        setDoc(doc(firestore, "templates/hidden-template"), { visibility: "hidden", title: "Hidden" }),
        setDoc(doc(firestore, "publishers/publisher"), { keyId: "publisher", publicKey: "fixture-public-key" }),
        setDoc(doc(firestore, "releases/release"), { templateId: "public-template" }),
        setDoc(doc(firestore, "publishRequests/request"), { requestId: "request" }),
      ]);
    });
  });

  afterAll(async () => environment.cleanup());

  test("exposes only public catalog metadata and denies all client writes", async () => {
    const firestore = environment.unauthenticatedContext().firestore();
    await assertSucceeds(getDoc(doc(firestore, "templates/public-template")));
    await assertSucceeds(getDoc(doc(firestore, "publishers/publisher")));
    await assertFails(getDoc(doc(firestore, "templates/hidden-template")));
    await assertFails(getDoc(doc(firestore, "releases/release")));
    await assertFails(getDoc(doc(firestore, "publishRequests/request")));
    await assertFails(setDoc(doc(firestore, "templates/new-template"), { visibility: "public" }));
    expect(true).toBe(true);
  });
}
