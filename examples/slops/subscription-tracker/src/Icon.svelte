<script lang="ts">
  import theme from "../theme";
  import * as s from "./styles.css";
</script>
<div class={s.iconSurface} aria-hidden="true">
  <svg class={s.iconGraphic} viewBox="0 0 512 512" fill="none">
    <rect x="28" y="28" width="456" height="456" rx="104" fill={theme.vars.accentInk}/>
    <rect x="145" y="135" width="242" height="224" rx="30" transform="rotate(9 145 135)" fill={theme.vars.accent}/>
    <rect x="111" y="152" width="242" height="224" rx="30" fill={theme.vars.paper}/>
    <path d="M144 206H320" stroke={theme.vars.paperSoft} stroke-width="25"/>
    <path d="M153 266H242M153 314H206" stroke={theme.vars.accentInk} stroke-width="16" stroke-linecap="round"/>
    <path d="M90 184A178 178 0 0 1 407 153M407 153V92M407 153H348M422 330A178 178 0 0 1 105 361M105 361V422M105 361H164" stroke={theme.vars.mint} stroke-width="23" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>
</div>
