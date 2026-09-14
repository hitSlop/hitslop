<script lang="ts">
  import type { ChannelLevels } from "../schema";
  import { CHANNEL_IDS } from "../schema";
  import * as s from "./styles.css";

  let { channels, playing = false }: { channels: ChannelLevels; playing?: boolean } = $props();
</script>

<div class={s.iconSurface} aria-hidden="true">
  <div class={s.iconShell}>
    <div class={s.iconTop}>
      <span class={s.iconPill}></span>
      <span class={s.iconLamp} data-on={playing}></span>
    </div>
    <div class={s.iconDeck}>
      {#each CHANNEL_IDS as id}
        <div class={s.iconSlot}>
          <div class={s.iconCap} style:bottom={`${Math.max(8, Math.min(86, channels[id]))}%`}></div>
        </div>
      {/each}
    </div>
    <div class={s.iconVu}>
      <span></span><span></span><span></span><span></span><span></span><span></span><span data-hot="true"></span>
    </div>
  </div>
</div>
