<script lang="ts">
  import Readout from "./Readout.svelte";
  import * as styles from "./styles.css";
  let { title, count }: { title: string; count: number } = $props();
</script>

<section class={styles.exportSurface} aria-label={title}>
  <Readout {title} {count} />
</section>
