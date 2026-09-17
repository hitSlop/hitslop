import { Authority, MockHost } from "./host.ts";
import { documentStore } from "./document-store.svelte.ts";
import { schema, initial, counterSchema } from "./checklist-schema.ts";

export function createDemo() {
  const authority = new Authority(schema, initial), counter = new Authority(counterSchema, { count: 0 });
  const clients = ["A", "B"].map(name => {
    const host = new MockHost(authority, name), counterHost = new MockHost(counter, name);
    return { name, host, counterHost, store: documentStore({ schema, initial, host }),
      counter: documentStore({ schema: counterSchema, initial: { count: 0 }, host: counterHost }) };
  });
  return { authority, counter, clients, dispose() { for (const client of clients) {
    client.store.dispose(); client.counter.dispose(); client.host.dispose(); client.counterHost.dispose();
  } } };
}
export type Client = ReturnType<typeof createDemo>["clients"][number];
