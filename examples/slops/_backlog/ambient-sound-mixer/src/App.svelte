<script lang="ts">
  import { capture, ready } from "@hitslop/runtime";
  import { jsonStore, IconTarget, ExportTarget } from "@hitslop/svelte";
  import { onDestroy, onMount, tick, untrack } from "svelte";
  import { Tween, prefersReducedMotion } from "svelte/motion";
  import { cubicOut } from "svelte/easing";
  import { Select, Slider, Toggle, Button } from "bits-ui";
  import Power from "@lucide/svelte/icons/power";
  import CloudRain from "@lucide/svelte/icons/cloud-rain";
  import CloudLightning from "@lucide/svelte/icons/cloud-lightning";
  import Wind from "@lucide/svelte/icons/wind";
  import Bird from "@lucide/svelte/icons/bird";
  import Moon from "@lucide/svelte/icons/moon";
  import ChevronDown from "@lucide/svelte/icons/chevron-down";
  import Check from "@lucide/svelte/icons/check";
  import mixerSchema, { CHANNEL_IDS, type ChannelID, type ChannelLevels } from "../schema";
  import { AmbientEngine } from "./engine";
  import Icon from "./Icon.svelte";
  import Export from "./Export.svelte";
  import * as s from "./styles.css";

  type MixerPreset = { name: string; levels: ChannelLevels };

  const PRESETS: MixerPreset[] = [
    { name: "Lo-Fi Rain", levels: { rain: 75, thunder: 20, wind: 35, birds: 0, night: 40 } },
    { name: "Forest Dawn", levels: { rain: 15, thunder: 0, wind: 40, birds: 85, night: 10 } },
    { name: "Midnight Storm", levels: { rain: 85, thunder: 70, wind: 60, birds: 0, night: 0 } },
    { name: "Cozy Evening", levels: { rain: 30, thunder: 0, wind: 25, birds: 20, night: 75 } },
  ];
  const PRESET_ITEMS = PRESETS.map((preset) => ({ value: preset.name, label: preset.name }));
  const CHANNELS = [
    { id: "rain" as const, label: "Rain", icon: CloudRain },
    { id: "thunder" as const, label: "Thunder", icon: CloudLightning },
    { id: "wind" as const, label: "Wind", icon: Wind },
    { id: "birds" as const, label: "Birds", icon: Bird },
    { id: "night" as const, label: "Night", icon: Moon },
  ];
  const silentFlags = { rain: false, thunder: false, wind: false, birds: false, night: false };

  const doc = jsonStore({
    schema: mixerSchema,
    initial: {
      preset: "Lo-Fi Rain",
      master: 80,
      playing: false,
      channels: { ...PRESETS[0]!.levels },
      muted: { ...silentFlags },
      soloed: { ...silentFlags },
    },
  });

  const travel = {
    rain: new Tween(untrack(() => 75), { duration: 0, easing: cubicOut }),
    thunder: new Tween(untrack(() => 20), { duration: 0, easing: cubicOut }),
    wind: new Tween(untrack(() => 35), { duration: 0, easing: cubicOut }),
    birds: new Tween(untrack(() => 0), { duration: 0, easing: cubicOut }),
    night: new Tween(untrack(() => 40), { duration: 0, easing: cubicOut }),
  } satisfies Record<ChannelID, Tween<number>>;

  const engine = new AmbientEngine();
  let audioArmed = false;
  let snapped = false;
  let freezeVu = false;
  let vuLevel = $state(0);
  let vuTimer: ReturnType<typeof setInterval> | null = null;

  const anySolo = $derived(CHANNEL_IDS.some((id) => doc.current.soloed[id]));
  const presetItems = $derived(doc.current.preset === "Custom" ? [{ value: "Custom", label: "Custom" }, ...PRESET_ITEMS] : PRESET_ITEMS);
  const mixStatus = $derived.by(() => {
    if (!doc.current.playing) return "Standby";
    if (!CHANNEL_IDS.some((id) => isAudible(id) && doc.current.channels[id] > 0)) return "Silent";
    if (anySolo) return "Solo";
    return "Live";
  });

  function isAudible(id: ChannelID): boolean {
    if (doc.current.muted[id]) return false;
    return anySolo ? doc.current.soloed[id] : true;
  }

  function audibleLevels(): ChannelLevels {
    const next = { ...doc.current.channels };
    for (const id of CHANNEL_IDS) {
      if (!isAudible(id)) next[id] = 0;
    }
    return next;
  }

  function mixEnergy(): number {
    if (!doc.current.playing) return 0;
    const levels = audibleLevels();
    const sum = CHANNEL_IDS.reduce((total, id) => total + levels[id], 0);
    return Math.min(1, (sum / 500) * (doc.current.master / 100));
  }

  function shown(id: ChannelID): number {
    return Math.round(travel[id].current);
  }

  function markCustomIfNeeded(): void {
    const preset = PRESETS.find((item) => item.name === doc.current.preset);
    if (!preset) return;
    const matches = CHANNEL_IDS.every((id) => Math.round(doc.current.channels[id]) === Math.round(preset.levels[id]));
    if (!matches) doc.current.preset = "Custom";
  }

  function setChannel(id: ChannelID, value: number): void {
    const next = Math.min(100, Math.max(0, Math.round(value)));
    doc.current.channels[id] = next;
    void travel[id].set(next, { duration: 0, delay: 0 });
    markCustomIfNeeded();
  }

  function applyPreset(name: string): void {
    const preset = PRESETS.find((item) => item.name === name);
    if (!preset) return;
    doc.current.preset = preset.name;
    doc.current.channels = { ...preset.levels };
    doc.current.muted = { ...silentFlags };
    doc.current.soloed = { ...silentFlags };
    const duration = prefersReducedMotion.current ? 0 : 320;
    for (const id of CHANNEL_IDS) void travel[id].set(preset.levels[id], { duration, delay: 0 });
  }

  async function togglePower(): Promise<void> {
    const opened = await engine.ensure();
    if (!opened) return;
    if (!audioArmed && doc.current.playing) {
      audioArmed = true;
      engine.setMix(true, doc.current.master, audibleLevels());
      return;
    }
    audioArmed = true;
    doc.current.playing = !doc.current.playing;
  }

  $effect(() => { if (doc.isReady) ready(); });

  $effect(() => {
    if (!doc.isReady || snapped) return;
    snapped = true;
    for (const id of CHANNEL_IDS) void travel[id].set(doc.current.channels[id], { duration: 0, delay: 0 });
  });

  $effect(() => {
    const playing = doc.current.playing;
    const master = doc.current.master;
    const levels = audibleLevels();
    if (engine.isOpen) engine.setMix(playing, master, levels);
  });

  function paintVu(): void {
    if (freezeVu) return;
    const energy = mixEnergy();
    if (!doc.current.playing || prefersReducedMotion.current) {
      vuLevel = Math.round(energy * 10);
      return;
    }
    vuLevel = Math.max(0, Math.min(10, Math.round(energy * 10 + (Math.random() * 2 - 1))));
  }

  $effect(() => {
    if (!prefersReducedMotion.current) return;
    for (const id of CHANNEL_IDS) void travel[id].set(doc.current.channels[id], { duration: 0, delay: 0 });
  });

  onMount(() => {
    vuTimer = setInterval(paintVu, 120);
    return capture.onPrepare(async () => {
      freezeVu = true;
      vuLevel = Math.round(mixEnergy() * 10);
      for (const id of CHANNEL_IDS) await travel[id].set(doc.current.channels[id], { duration: 0, delay: 0 });
      await tick();
    });
  });

  onDestroy(() => {
    if (vuTimer) clearInterval(vuTimer);
    for (const id of CHANNEL_IDS) void travel[id].set(travel[id].target, { duration: 0, delay: 0 });
    engine.close();
    doc.destroy();
  });
</script>

<main class={s.canvas} data-slop-selection="none" aria-busy={doc.isLoading} aria-label="Ambient sound mixer">
  <article class={s.chassis}>
    <header class={s.header}>
      <div class={s.brand}><strong>Atmos 01</strong></div>
      <Select.Root type="single" value={doc.current.preset} items={presetItems} onValueChange={(value) => { if (value && value !== "Custom") applyPreset(value); }}>
        <Select.Trigger class={s.presetTrigger} aria-label="Mixer preset" data-slop-export="hide">
          <Select.Value placeholder="Preset" />
          <ChevronDown size={13} />
        </Select.Trigger>
        <Select.Portal>
          <Select.Content class={s.presetContent} sideOffset={6}>
            <Select.Viewport>
              {#each presetItems as item (item.value)}
                <Select.Item value={item.value} label={item.label}>
                  {#snippet children({ selected })}
                    <span>{item.label}</span>
                    {#if selected}<Check size={13} />{/if}
                  {/snippet}
                </Select.Item>
              {/each}
            </Select.Viewport>
          </Select.Content>
        </Select.Portal>
      </Select.Root>

      <div class={s.headerRight}>
        <div class={s.masterDial}>
          <span>Master</span>
          <Slider.Root type="single" bind:value={doc.current.master} min={0} max={100} step={1} class={s.masterSlider} aria-label="Master volume">
            {#snippet children({ thumbs })}
              <span class={s.masterTrack}><Slider.Range class={s.masterRange} /></span>
              {#each thumbs as index}<Slider.Thumb {index} class={s.masterThumb} aria-label="Master volume" />{/each}
            {/snippet}
          </Slider.Root>
        </div>
        <Button.Root type="button" class={s.power} data-on={doc.current.playing} onclick={() => void togglePower()} aria-pressed={doc.current.playing} aria-label={doc.current.playing ? "Stop mix" : "Start mix"}>
          <Power size={16} />
        </Button.Root>
      </div>
    </header>

    <section class={s.deck} aria-label="Audio channel faders">
      {#each CHANNELS as ch}
        {@const IconComp = ch.icon}
        {@const level = shown(ch.id)}
        {@const muted = doc.current.muted[ch.id]}
        {@const soloed = doc.current.soloed[ch.id]}
        <div class={s.strip} data-audible={isAudible(ch.id)} data-soloed={soloed}>
          <div class={s.channelInfo}>
            <IconComp size={15} />
            <span class={s.channelName}>{ch.label}</span>
          </div>
          <div class={s.faderWell}>
            <span class={s.ticks} aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></span>
            <Slider.Root
              type="single"
              value={level}
              onValueChange={(value) => setChannel(ch.id, value)}
              min={0}
              max={100}
              step={1}
              orientation="vertical"
              class={s.channelSlider}
              aria-label="{ch.label} level"
            >
              {#snippet children({ thumbs })}
                <span class={s.faderGroove}><Slider.Range class={s.faderRange} /></span>
                {#each thumbs as index}
                  <Slider.Thumb {index} class={s.faderCap} aria-label="{ch.label} level">
                    <span class={s.faderLine}></span>
                  </Slider.Thumb>
                {/each}
              {/snippet}
            </Slider.Root>
          </div>
          <div class={s.channelBottom}>
            <span class={s.channelLevel}>{doc.current.channels[ch.id]}</span>
            <div class={s.padRow}>
              <Toggle.Root class={s.pad} data-kind="mute" pressed={muted} onPressedChange={(pressed) => { doc.current.muted[ch.id] = pressed; }} aria-label="Mute {ch.label}">M</Toggle.Root>
              <Toggle.Root class={s.pad} data-kind="solo" pressed={soloed} onPressedChange={(pressed) => { doc.current.soloed[ch.id] = pressed; }} aria-label="Solo {ch.label}">S</Toggle.Root>
            </div>
          </div>
        </div>
      {/each}
    </section>

    <footer class={s.footer}>
      <div class={s.vuRow} aria-hidden="true">
        {#each Array(10) as _, index}
          {@const lit = index < vuLevel ? (index >= 8 ? "red" : index >= 6 ? "amber" : "green") : ""}
          <span class={s.vuSegment} data-lit={lit}></span>
        {/each}
      </div>
      <span class={s.status} aria-live="polite">{mixStatus}</span>
    </footer>
  </article>

  {#if doc.error}
    <div class={s.error} role="alert">{doc.isReady ? "The mix couldn’t be saved." : "The mix couldn’t be loaded."} {doc.error}</div>
  {:else if doc.isLoading}
    <p class={s.error} role="status">Loading the deck…</p>
  {/if}
</main>

<IconTarget><Icon channels={doc.current.channels} playing={doc.current.playing} /></IconTarget>
<ExportTarget><Export data={doc.current} /></ExportTarget>
