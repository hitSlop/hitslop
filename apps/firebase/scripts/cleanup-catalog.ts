import { initializeApp, deleteApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { RegistryTemplateSchema } from "@hitslop/schema";
import { readRegistryDocument } from "../src/registry-codec";

// One-time pre-release cleanup. Defaults to inspection; never touches release history or Storage.
const args = process.argv.slice(2);
if (args.some(arg => arg !== "--apply" && arg !== "--check")) throw new Error("Usage: bun scripts/cleanup-catalog.ts [--apply | --check]");
const apply = args.includes("--apply");
const app = initializeApp({ projectId: "hitslopapp" });
const db = getFirestore(app);
try {
  const snapshot = await db.collection("templates").get();
  const obsolete = snapshot.docs.filter(doc => Object.hasOwn(doc.data(), "searchText"));
  for (const doc of snapshot.docs) {
    const { searchText: _, ...value } = doc.data();
    const template = readRegistryDocument(RegistryTemplateSchema, value);
    if (template.id !== doc.id) throw new Error(`Mismatched template id: ${doc.id}`);
  }
  console.log(`Validated ${snapshot.size} templates; ${obsolete.length} contain obsolete searchText.`);
  if (apply) {
    for (const doc of obsolete) {
      await db.runTransaction(async transaction => {
        const current = await transaction.get(doc.ref);
        if (!current.exists) return;
        const { searchText: _, ...value } = current.data()!;
        readRegistryDocument(RegistryTemplateSchema, value);
        transaction.update(doc.ref, { searchText: FieldValue.delete() });
      });
    }
    console.log("Removed searchText; all other fields and collections preserved.");
  }
  for (const category of [undefined, "utilities"]) {
    for (const sort of ["popular", "new"]) {
      let query = db.collection("templates").where("visibility", "==", "public");
      if (category) query = query.where("categories", "array-contains", category);
      if (sort === "popular") query = query.orderBy("creationCount", "desc");
      const result = await query.orderBy("firstPublishedAt", "desc").limit(200).get();
      console.log(`${category ?? "all"}/${sort}: ${result.size} templates`);
    }
  }
} finally {
  await deleteApp(app);
}
