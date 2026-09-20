<script lang="ts">
  import * as styles from "./styles.css";
  let { title, count }: { title: string; count: number } = $props();
</script>

<header>
  <span class={styles.eyebrow}>Quick counter</span>
  <h1 class={styles.heading}>{title}</h1>
</header>
<div class={styles.readout}>
  <output class={styles.output} aria-live="polite">{count}</output>
  <span class={styles.readoutLabel}>things counted</span>
</div>
