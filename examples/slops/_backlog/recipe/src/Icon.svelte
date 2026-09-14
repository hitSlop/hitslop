<script lang="ts">
  import theme from "../theme";
  import * as s from "./styles.css";
</script>
<div class={s.iconSurface} aria-hidden="true">
  <svg class={s.iconBook} viewBox="0 0 512 512" fill="none">
    <path d="M32 110Q142 76 256 118Q370 76 480 110V402Q368 370 256 412Q144 370 32 402Z" fill="currentColor" />
    <path d="M53 91Q151 63 246 108V382Q145 345 53 373Z" fill={theme.vars.paper} stroke="currentColor" stroke-width="12" stroke-linejoin="round" />
    <path d="M266 108Q361 63 459 91V373Q367 345 266 382Z" fill={theme.vars.paper} stroke="currentColor" stroke-width="12" stroke-linejoin="round" />
    <path d="M343 86L393 86V228L368 207L343 228Z" fill={theme.vars.tomato} />
    <g stroke="currentColor" stroke-width="12" stroke-linecap="round">
      <path d="M89 262L209 275M89 301L182 311M306 276L418 263M306 316L393 305" />
      <path d="M120 170H192V198Q156 225 120 198ZM114 159H198M151 141H161" />
    </g>
  </svg>
</div>
