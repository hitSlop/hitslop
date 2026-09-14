<script lang="ts">
  import Check from "@lucide/svelte/icons/check";
  import * as s from "./styles.css";
</script>

<div class={s.iconSurface} aria-hidden="true">
  <div class={s.iconSheet}>
    <span class={s.iconTab}></span><span class={s.iconRule}></span><span
      class={s.iconRule}
      style="top:33%;right:32%"
    ></span><span class={s.iconCheck}
      ><Check style="width:70%;height:70%" strokeWidth={3.5} /></span
    >
  </div>
</div>
