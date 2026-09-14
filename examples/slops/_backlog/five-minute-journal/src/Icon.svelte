<script lang="ts">
  import Sun from "@lucide/svelte/icons/sun";
  import Moon from "@lucide/svelte/icons/moon";
  import Check from "@lucide/svelte/icons/check";
  import * as s from "./styles.css";
  let { morningDone = false, eveningDone = false }: { morningDone?: boolean; eveningDone?: boolean } = $props();
</script>
<div class={s.iconSurface} aria-hidden="true">
  <article class={s.iconPlate}>
    <div class={s.iconBookmarks}>
      <span class={s.iconMorning}><Sun size={30} strokeWidth={1.5} /></span>
      <span class={s.iconEvening}><Moon size={30} strokeWidth={1.5} /></span>
    </div>
    <span class={s.iconTitle}>Five<br />Minute<br />Journal</span>
    <div class={s.iconEntry}><Sun size={22} /><span class={s.iconRule}></span>{#if morningDone}<Check size={22} />{/if}</div>
    <div class={s.iconEntry}><Moon size={22} /><span class={s.iconRule}></span>{#if eveningDone}<Check size={22} />{/if}</div>
  </article>
</div>
