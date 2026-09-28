<script lang="ts">
  import { useDocument } from "@hitslop/document/svelte";
  import schema from "./schema";
  const doc = useDocument(schema);
  let { checked = $bindable(false) }: { checked?: boolean } = $props();
</script>

<p data-child-title>{doc.current.title}</p>
<input data-child-toggle type="checkbox" bind:checked />
