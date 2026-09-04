<script lang="ts">
  import Check from "@lucide/svelte/icons/check";
  import { iconTile, iconPaper } from "./styles.css";
</script>
<section data-slop-render="icon" aria-hidden="true">
  <div class={iconTile}><div class={iconPaper}>
    <div><span><Check size={32} strokeWidth={3} /></span><i></i></div>
    <div><span></span><i></i></div>
    <div><span></span><i></i></div>
  </div></div>
</section>
