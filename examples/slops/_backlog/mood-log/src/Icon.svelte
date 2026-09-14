<script lang="ts">
  import theme from "../theme";
  import * as s from "./styles.css";
  const colors = [theme.vars.orb1, theme.vars.orb2, theme.vars.orb3, theme.vars.orb4, theme.vars.orb5];
</script>
<div class={s.iconSurface} aria-hidden="true">
  <div class={s.iconSheet}>
    <div class={s.iconTitle}></div>
    <div class={s.iconOrbs}>{#each colors as color, index}<span style:background={color} data-active={index === 4}></span>{/each}</div>
    <div class={s.iconLine}></div><div class={s.iconLine}></div><div class={s.iconLine}></div>
  </div>
</div>
