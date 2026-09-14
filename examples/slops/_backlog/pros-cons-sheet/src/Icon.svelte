<script lang="ts">
  import * as s from "./styles.css";
  let { tilt = 0 }: { tilt?: number } = $props();
</script>

<div class={s.iconSurface} aria-hidden="true">
  <div class={s.iconTile}>
    <article class={s.iconSheet}>
      <div class={s.iconHead}>
        <div class={s.iconBeam} style:transform={`rotate(${tilt}deg)`}>
          <span class={s.iconBar}></span>
          <span class={s.iconPan} style:transform={`rotate(${-tilt}deg)`}></span>
          <span class={s.iconPan} style:transform={`rotate(${-tilt}deg)`}></span>
        </div>
      </div>
      <div class={s.iconCols}>
        <div class={s.iconCol}>
          <span class={s.iconLine} data-side="for"></span>
          <span class={s.iconLine} data-side="for"></span>
          <span class={s.iconLine} data-side="for"></span>
        </div>
        <div class={s.iconCol}>
          <span class={s.iconLine} data-side="against"></span>
          <span class={s.iconLine} data-side="against"></span>
        </div>
      </div>
    </article>
  </div>
</div>
