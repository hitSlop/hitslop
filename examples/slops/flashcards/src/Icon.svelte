<script lang="ts">
  import theme from "../theme";
  import * as s from "./styles.css";
</script>
<div class={s.iconSurface} aria-hidden="true">
  <svg class={s.iconGraphic} viewBox="0 0 512 512" fill="none">
    <rect x="30" y="30" width="452" height="452" rx="104" fill={theme.vars.wood}/>
    <rect x="120" y="102" width="300" height="286" rx="28" transform="rotate(10 120 102)" fill={theme.vars.brassHi}/>
    <rect x="76" y="128" width="310" height="282" rx="28" fill={theme.vars.card}/>
    <path d="M173 220C173 180 256 173 260 218C264 250 221 248 221 282" stroke={theme.vars.wood} stroke-width="22" stroke-linecap="round"/>
    <circle cx="221" cy="322" r="12" fill={theme.vars.wood}/>
    <circle cx="375" cy="377" r="70" fill={theme.vars.good}/>
    <path d="M343 377L366 400L407 351" stroke={theme.vars.ink} stroke-width="16" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>
</div>
