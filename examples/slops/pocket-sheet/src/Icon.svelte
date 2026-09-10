<script lang="ts">
  import * as s from "./styles.css";
</script>

<div class={s.iconSurface} aria-hidden="true">
  <div class={s.iconBody}>
    <div class={s.iconFx}>
      <span class={s.iconFxTag}>fx</span>
      <span class={s.iconFxText}>=SUM(B2:B5)</span>
    </div>
    <div class={s.iconGrid}>
      <div class={`${s.iconRow} ${s.iconHeaderRow}`}>
        <span class={`${s.iconCell} ${s.iconCorner}`}></span>
        <span class={`${s.iconCell} ${s.iconColHdr}`}>A</span>
        <span class={`${s.iconCell} ${s.iconColHdr}`}>B</span>
        <span class={`${s.iconCell} ${s.iconColHdr}`}>C</span>
      </div>
      <div class={s.iconRow}>
        <span class={`${s.iconCell} ${s.iconRowHdr}`}>1</span>
        <span class={`${s.iconCell} ${s.iconLeft}`}>MRR</span>
        <span class={`${s.iconCell} ${s.iconRight}`}>12,400</span>
        <span class={`${s.iconCell} ${s.iconPill}`}>DONE</span>
      </div>
      <div class={s.iconRow}>
        <span class={`${s.iconCell} ${s.iconRowHdr}`}>2</span>
        <span class={`${s.iconCell} ${s.iconLeft}`}>ARR</span>
        <span class={`${s.iconCell} ${s.iconRight}`}>148,800</span>
        <span class={`${s.iconCell} ${s.iconPill} ${s.iconPillLive}`}>LIVE</span>
      </div>
      <div class={s.iconRow}>
        <span class={`${s.iconCell} ${s.iconRowHdr}`}>3</span>
        <span class={`${s.iconCell} ${s.iconLeft}`}>Growth</span>
        <span class={`${s.iconCell} ${s.iconRight} ${s.iconSelected}`}>
          +34.2%
          <span class={s.iconHandle}></span>
        </span>
        <span class={`${s.iconCell} ${s.iconBar}`}><span class={s.iconBarFill}></span></span>
      </div>
      <div class={s.iconRow}>
        <span class={`${s.iconCell} ${s.iconRowHdr}`}>4</span>
        <span class={`${s.iconCell} ${s.iconLeft} ${s.iconBold}`}>TOTAL</span>
        <span class={`${s.iconCell} ${s.iconRight} ${s.iconBold}`}>161,200</span>
        <span class={`${s.iconCell} ${s.iconCenter}`}>★★★</span>
      </div>
    </div>
    <div class={s.iconStatus}>
      <span>SUM: 161,200</span>
      <span>AVG: 53,733</span>
    </div>
  </div>
</div>
