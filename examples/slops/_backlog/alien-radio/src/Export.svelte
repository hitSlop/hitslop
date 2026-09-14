<script lang="ts">
  import chromeUrl from "../assets/alien-radio-chrome.png";
  import * as s from "./styles.css";
  let { title, status, track }: { title: string; status: string; track: string } = $props();
</script>
<article class={s.radio} aria-label="Exported Alien Radio">
  <img class={s.chrome} src={chromeUrl} alt="" />
  <header class={s.identity}><span class={s.lamp}></span><strong>ALIEN RADIO</strong><small>INTERSTELLAR RECEIVER / AR-01</small></header>
  <section class={s.display}>
    <div class={s.topline}><span>{status}</span><span>LOCAL INDEX</span><span>—</span></div>
    <div class={s.station}><span>broadcast</span><strong>{title}</strong></div>
    <p class={s.track}>{track}</p>
  </section>
</article>
