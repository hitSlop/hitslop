<script lang="ts">
  import { createDocument, Slop } from "@hitslop/svelte";
  import { onDestroy } from "svelte";
  import schema, { initial } from "./wrapper-schema";
  import Child from "./WrapperChild.svelte";
  const store = createDocument({ schema, initial });
  const { fields } = store;
  let broken = $state(false);
  function content() {
    if (broken) throw new Error("Deliberate render failure");
    return "Ready";
  }
  const test = {
    store,
    fail() { broken = true; },
    repair() { broken = false; },
  };
  Object.assign(window, { wrapperTest: test });
  onDestroy(() => Reflect.deleteProperty(window, "wrapperTest"));
</script>
<Slop document={store}>
  <p>{content()}</p>
  <Child />
  <input id="title" {@attach store.text(fields.title)} />
  <button id="increment" onclick={() => { void store.increment(fields.count); }}>Increment</button>
  <button id="reject" onclick={() => { void store.set(fields.title, "x".repeat(40)); }}>Reject</button>
  {#snippet exportView()}<p>{store.data.title}</p>{/snippet}
</Slop>
