<script lang="ts">
  import { useSlop } from "@hitslop/svelte";
  import schema from "./wrapper-schema";
  const store = useSlop(schema);
</script>
<output id="child-count">{store.data.count}</output>
