<script lang="ts">
  import Star from "@lucide/svelte/icons/star";
  import * as s from "./styles.css";
  const columns = [
    ["sage", "indigo", "terracotta"],
    ["slate", "rose", "sage"],
    ["terracotta", "teal", "indigo"],
    ["indigo", "sage", "amber"],
    ["teal", "terracotta", "rose"],
  ];
</script>

<div class={s.iconSurface} aria-hidden="true">
  <div class={s.iconBoard}>
    <span class={s.iconLabel}>MY WEEK</span><span class={s.iconStar}
      ><Star size={46} strokeWidth={2.5} /></span
    >
    <div class={s.iconGrid}>
      {#each columns as col}<div class={s.iconColumn}>
          {#each col as color}<span class={s.iconTile} data-color={color}
            ></span>{/each}
        </div>{/each}
    </div>
  </div>
</div>
