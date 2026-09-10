<script lang="ts">
  import * as s from "./styles.css";

  let {
    guesses = 2,
    status = "playing",
  }: {
    guesses?: number;
    status?: "playing" | "won" | "lost";
  } = $props();

  const badge = $derived(status === "won" ? `${guesses}/6` : status === "lost" ? "X/6" : "SLOPS");
</script>

<div class={s.iconSurface} aria-hidden="true">
  <div class={s.iconBezel}>
    <div class={s.iconBrandStrip}>
      <span class={s.iconBrandDot}></span>
      <span class={s.iconBrandTitle}>WORDLE</span>
      <span class={s.iconBrandDot}></span>
    </div>
    <div class={s.iconGrid}>
      <div class={s.iconRow}>
        <div class={s.iconTile} data-tone="absent">W</div>
        <div class={s.iconTile} data-tone="present">O</div>
        <div class={s.iconTile} data-tone="absent">R</div>
        <div class={s.iconTile} data-tone="absent">D</div>
        <div class={s.iconTile} data-tone="present">S</div>
      </div>
      <div class={s.iconRow}>
        <div class={s.iconTile} data-tone="correct">S</div>
        <div class={s.iconTile} data-tone="correct">L</div>
        <div class={s.iconTile} data-tone="correct">O</div>
        <div class={s.iconTile} data-tone="correct">P</div>
        <div class={s.iconTile} data-tone="correct">S</div>
      </div>
      <div class={s.iconRow}>
        <div class={s.iconTile} data-tone="empty"></div>
        <div class={s.iconTile} data-tone="empty"></div>
        <div class={s.iconTile} data-tone="empty"></div>
        <div class={s.iconTile} data-tone="empty"></div>
        <div class={s.iconTile} data-tone="empty"></div>
      </div>
    </div>
    <div class={s.iconIndicator}>
      <div class={s.iconBar}></div>
      <span class={s.iconBadge}>{badge}</span>
    </div>
  </div>
</div>
