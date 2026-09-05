<script lang="ts">
  import Check from "@lucide/svelte/icons/check";
  import * as s from "./styles.css";
</script>
<header class={s.header}>
  <span class={s.brand}><Check size={15} strokeWidth={3} /> Quick Checklist</span>
  <span class={s.edition} aria-hidden="true">ONE THING AT A TIME</span>
</header>
