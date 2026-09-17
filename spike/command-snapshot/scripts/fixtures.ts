import { fixtureSchema, initial, scenarios } from "../tests/fixtures.ts";
const payload = { version: 1, description: "Explicit expected outcomes, reusable by a future Swift interpreter. Fresh authority per scenario.", schema: fixtureSchema, initial, scenarios };
await Bun.write(new URL("../fixtures/operations.json", import.meta.url), JSON.stringify(payload, null, 2) + "\n");
console.log(`Wrote ${scenarios.length} portable scenarios`);
