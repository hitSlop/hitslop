<script lang="ts">
  import Film from "@lucide/svelte/icons/film";
  import BriefcaseBusiness from "@lucide/svelte/icons/briefcase-business";
  import House from "@lucide/svelte/icons/house";
  import HeartPulse from "@lucide/svelte/icons/heart-pulse";
  import Repeat2 from "@lucide/svelte/icons/repeat-2";
  import * as s from "./styles.css";
  let { category }: { category: string } = $props();
  const marks = { Entertainment: Film, Work: BriefcaseBusiness, Home: House, Health: HeartPulse };
  const Mark = $derived(marks[category as keyof typeof marks] ?? Repeat2);
</script>
<span class={s.categoryMark} data-category={category} aria-hidden="true"><Mark size={19} strokeWidth={1.8} /></span>
