<script lang="ts">
  import { Slop, useDocument } from "@hitslop/document/svelte";
  import schema from "./schema";
  const document = useDocument(schema);
</script>
<Slop {document}>
  <main class="editor"><button onclick={() => document.fields.count.set(document.current.count + 1)}>Clicks: {document.current.count}</button></main>
  {#snippet exportView()}<article class="export"><h1>Presentation</h1><p>Clicks: {document.current.count}</p></article>{/snippet}
  {#snippet icon()}<div class="icon"></div>{/snippet}
</Slop>
