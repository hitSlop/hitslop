<script lang="ts">
  import CloudRain from "@lucide/svelte/icons/cloud-rain";
  import CloudLightning from "@lucide/svelte/icons/cloud-lightning";
  import Wind from "@lucide/svelte/icons/wind";
  import Bird from "@lucide/svelte/icons/bird";
  import Moon from "@lucide/svelte/icons/moon";
  import { CHANNEL_IDS, type ChannelID, type MixerData } from "../schema";
  import * as s from "./styles.css";

  let { data }: { data: MixerData } = $props();

  const CHANNELS = [
    { id: "rain" as const, label: "Rain", icon: CloudRain },
    { id: "thunder" as const, label: "Thunder", icon: CloudLightning },
    { id: "wind" as const, label: "Wind", icon: Wind },
    { id: "birds" as const, label: "Birds", icon: Bird },
    { id: "night" as const, label: "Night", icon: Moon },
  ];

  const anySolo = $derived(CHANNEL_IDS.some((id) => data.soloed[id]));
  const mixStatus = $derived.by(() => {
    if (!data.playing) return "Standby";
    const live = CHANNEL_IDS.some((id) => isAudible(id) && data.channels[id] > 0);
    if (!live) return "Silent";
    return anySolo ? "Solo" : "Live";
  });

  function isAudible(id: ChannelID): boolean {
    if (data.muted[id]) return false;
    return anySolo ? data.soloed[id] : true;
  }
</script>

<article class={s.exportCanvas} aria-label="Exported ambient mixer">
  <div class={s.chassis}>
    <header class={s.header}>
      <div class={s.brand}>
        <strong>Atmos 01</strong>
        <span>{data.preset}</span>
      </div>
      <div class={s.headerRight}>
        <div class={s.masterDial}><span>Master {Math.round(data.master)}</span></div>
        <span class={s.power} data-on={data.playing} aria-hidden="true"></span>
      </div>
    </header>
    <section class={s.deck} aria-label="Channel mix">
      {#each CHANNELS as ch}
        {@const IconComp = ch.icon}
        {@const level = Math.round(data.channels[ch.id])}
        <div class={s.strip} data-audible={isAudible(ch.id)} data-soloed={data.soloed[ch.id]}>
          <div class={s.channelInfo}>
            <IconComp size={15} />
            <span class={s.channelName}>{ch.label}</span>
          </div>
          <div class={s.faderWell}>
            <span class={s.faderGroove}><span class={s.faderRange} style:height={`${level}%`}></span></span>
            <span class={s.staticCap} style:bottom={`${Math.max(6, Math.min(90, level))}%`}></span>
          </div>
          <div class={s.channelBottom}>
            <span class={s.channelLevel}>{level}</span>
            <div class={s.padRow}>
              <span class={s.pad} data-kind="mute" data-state={data.muted[ch.id] ? "on" : "off"}>M</span>
              <span class={s.pad} data-kind="solo" data-state={data.soloed[ch.id] ? "on" : "off"}>S</span>
            </div>
          </div>
        </div>
      {/each}
    </section>
    <footer class={s.footer}><span class={s.status}>{mixStatus}</span></footer>
  </div>
</article>
