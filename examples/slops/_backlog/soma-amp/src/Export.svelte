<script lang="ts">
  import { stations } from "./stations";
  import * as s from "./styles.css";
</script>
<section class={s.facsimile} aria-label="Classic audio player preview">
  <div class={s.stack}>
    <div class={`${s.panel} ${s.mainPanel}`}>
      <div class={s.title}><i></i><strong>WINAMP</strong><i></i></div>
      <div class={s.readout}><b>▶</b><span>GROOVE SALAD · SOMAFM</span><em>128 KBPS</em></div>
      <div class={s.controls}><button>◀</button><button>▶</button><button>Ⅱ</button><button>■</button><button>▶|</button><button>▴</button></div>
    </div>
    <div class={`${s.panel} ${s.eq}`}>
      <div class={s.title}><i></i><strong>WINAMP EQUALIZER</strong><i></i></div>
      <div class={s.eqHead}><b>ON</b><span>PRESETS</span></div>
      <div class={s.sliders}>{#each [72, 48, 62, 80, 54, 68, 43, 77, 58, 71, 51] as top}<i style:--top={`${top}px`}></i>{/each}</div>
    </div>
    <div class={`${s.panel} ${s.playlist}`}>
      <div class={s.title}><i></i><strong>WINAMP PLAYLIST</strong><i></i></div>
      <ol>{#each stations as station}<li>{station.genre} — {station.title}</li>{/each}</ol>
      <div class={s.playlistControls}><b>ADD</b><b>REM</b><b>SEL</b><b>MISC</b><span>0:00/0:00</span></div>
    </div>
  </div>
</section>
