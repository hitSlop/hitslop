<script lang="ts">
  import { capture } from "@hitslop/runtime";
  import { jsonStore } from "@hitslop/svelte";
  import Power from "@lucide/svelte/icons/power";
  import CloudRain from "@lucide/svelte/icons/cloud-rain";
  import CloudLightning from "@lucide/svelte/icons/cloud-lightning";
  import Wind from "@lucide/svelte/icons/wind";
  import Bird from "@lucide/svelte/icons/bird";
  import Moon from "@lucide/svelte/icons/moon";
  import ChevronDown from "@lucide/svelte/icons/chevron-down";
  import Check from "@lucide/svelte/icons/check";
  import { Select, Slider } from "bits-ui";
  import Icon from "./Icon.svelte";
  import { onDestroy, onMount } from "svelte";

  type ChannelID = "rain" | "thunder" | "wind" | "birds" | "night";

  type MixerPreset = {
    name: string;
    levels: Record<ChannelID, number>;
  };

  type MixerData = {
    preset: string;
    master: number;
    playing: boolean;
    channels: Record<ChannelID, number>;
    muted: Record<ChannelID, boolean>;
  };

  const PRESETS: MixerPreset[] = [
    {
      name: "Lo-Fi Rain",
      levels: { rain: 75, thunder: 20, wind: 35, birds: 0, night: 40 },
    },
    {
      name: "Forest Dawn",
      levels: { rain: 15, thunder: 0, wind: 40, birds: 85, night: 10 },
    },
    {
      name: "Midnight Storm",
      levels: { rain: 85, thunder: 70, wind: 60, birds: 0, night: 0 },
    },
    {
      name: "Cozy Evening",
      levels: { rain: 30, thunder: 0, wind: 25, birds: 20, night: 75 },
    },
  ];

  const doc = jsonStore<MixerData>({
    preset: "Lo-Fi Rain",
    master: 80,
    playing: false,
    channels: { rain: 75, thunder: 20, wind: 35, birds: 0, night: 40 },
    muted: { rain: false, thunder: false, wind: false, birds: false, night: false },
  });

  const CHANNELS: { id: ChannelID; label: string; icon: typeof CloudRain }[] = [
    { id: "rain", label: "Rain", icon: CloudRain },
    { id: "thunder", label: "Thunder", icon: CloudLightning },
    { id: "wind", label: "Wind", icon: Wind },
    { id: "birds", label: "Birds", icon: Bird },
    { id: "night", label: "Night", icon: Moon },
  ];

  // Web Audio Context & Synthesizer Nodes
  let audioCtx: AudioContext | null = null;
  let masterGain: GainNode | null = null;
  let channelGains: Partial<Record<ChannelID, GainNode>> = {};
  let intervalId: ReturnType<typeof setInterval> | null = null;
  let vuLevel = $state(0);

  function initAudio() {
    if (audioCtx) return;
    const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    audioCtx = new AudioCtxClass();

    masterGain = audioCtx.createGain();
    masterGain.gain.setValueAtTime((doc.current.master / 100), audioCtx.currentTime);
    masterGain.connect(audioCtx.destination);

    // 1. Rain (Filtered White Noise)
    const bufferSize = audioCtx.sampleRate * 2;
    const noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }
    const whiteNoise = audioCtx.createBufferSource();
    whiteNoise.buffer = noiseBuffer;
    whiteNoise.loop = true;

    const rainFilter = audioCtx.createBiquadFilter();
    rainFilter.type = "lowpass";
    rainFilter.frequency.value = 800;

    const rainGain = audioCtx.createGain();
    whiteNoise.connect(rainFilter);
    rainFilter.connect(rainGain);
    rainGain.connect(masterGain);
    whiteNoise.start(0);
    channelGains.rain = rainGain;

    // 2. Wind (Bandpass sweeping noise)
    const windNoise = audioCtx.createBufferSource();
    windNoise.buffer = noiseBuffer;
    windNoise.loop = true;
    const windFilter = audioCtx.createBiquadFilter();
    windFilter.type = "bandpass";
    windFilter.frequency.value = 400;
    windFilter.Q.value = 2;
    const windGain = audioCtx.createGain();
    windNoise.connect(windFilter);
    windFilter.connect(windGain);
    windGain.connect(masterGain);
    windNoise.start(0);
    channelGains.wind = windGain;

    // 3. Thunder (Low-pass rumble)
    const thunderNoise = audioCtx.createBufferSource();
    thunderNoise.buffer = noiseBuffer;
    thunderNoise.loop = true;
    const thunderFilter = audioCtx.createBiquadFilter();
    thunderFilter.type = "lowpass";
    thunderFilter.frequency.value = 120;
    const thunderGain = audioCtx.createGain();
    thunderNoise.connect(thunderFilter);
    thunderFilter.connect(thunderGain);
    thunderGain.connect(masterGain);
    thunderNoise.start(0);
    channelGains.thunder = thunderGain;

    // 4. Birds & 5. Night (Subtle synthesized oscillators)
    const birdOsc = audioCtx.createOscillator();
    birdOsc.type = "sine";
    birdOsc.frequency.value = 2800;
    const birdGain = audioCtx.createGain();
    birdOsc.connect(birdGain);
    birdGain.connect(masterGain);
    birdOsc.start(0);
    channelGains.birds = birdGain;

    const nightOsc = audioCtx.createOscillator();
    nightOsc.type = "sine";
    nightOsc.frequency.value = 4400;
    const nightGain = audioCtx.createGain();
    nightOsc.connect(nightGain);
    nightGain.connect(masterGain);
    nightOsc.start(0);
    channelGains.night = nightGain;

    updateAllGains();
  }

  function updateAllGains() {
    if (!audioCtx || !masterGain) return;
    const isPlaying = doc.current.playing;
    masterGain.gain.setTargetAtTime(isPlaying ? (doc.current.master / 100) : 0, audioCtx.currentTime, 0.05);

    for (const ch of CHANNELS) {
      const g = channelGains[ch.id];
      if (g) {
        const isMuted = doc.current.muted[ch.id];
        const val = isMuted ? 0 : (doc.current.channels[ch.id] / 100) * 0.2;
        g.gain.setTargetAtTime(val, audioCtx.currentTime, 0.05);
      }
    }
  }

  function togglePower() {
    initAudio();
    if (audioCtx?.state === "suspended") {
      audioCtx.resume();
    }
    doc.current.playing = !doc.current.playing;
    updateAllGains();
  }

  function toggleMute(id: ChannelID) {
    doc.current.muted[id] = !doc.current.muted[id];
    updateAllGains();
  }

  function applyPreset(presetName: string) {
    const p = PRESETS.find((item) => item.name === presetName);
    if (!p) return;
    doc.current.preset = p.name;
    doc.current.channels = { ...p.levels };
    updateAllGains();
  }

  onMount(() => {
    intervalId = setInterval(() => {
      if (doc.current.playing) {
        const total = (Object.values(doc.current.channels).reduce((a, b) => a + b, 0) / 500) * (doc.current.master / 100);
        vuLevel = Math.min(10, Math.round(total * 10 + (Math.random() * 2 - 1)));
      } else {
        vuLevel = 0;
      }
    }, 120);
  });

  onDestroy(() => {
    if (intervalId) clearInterval(intervalId);
    if (audioCtx) {
      audioCtx.close();
    }
  });

  $effect(() => {
    // Watch master and channels
    const _ = [doc.current.master, doc.current.channels, doc.current.playing, doc.current.muted];
    updateAllGains();
  });
</script>

<main class="mixer-canvas">
  <article class="mixer-chassis">
    <!-- Header -->
    <header class="mixer-header">
      <Select.Root
        type="single"
        value={doc.current.preset}
        onValueChange={(val) => {
          if (val) applyPreset(val);
        }}
      >
        <Select.Trigger class="preset-trigger" aria-label="Mixer preset">
          <Select.Value placeholder="Mixer preset" />
          <ChevronDown class="preset-chevron" size={13} />
        </Select.Trigger>
        <Select.Portal>
          <Select.Content class="preset-content" sideOffset={6}>
            <Select.Viewport>
              {#each PRESETS as p}
                <Select.Item class="preset-item" value={p.name} label={p.name}>
                  {#snippet children({ selected })}
                    <span>{p.name}</span>
                    {#if selected}
                      <Check size={13} class="preset-check" />
                    {/if}
                  {/snippet}
                </Select.Item>
              {/each}
            </Select.Viewport>
          </Select.Content>
        </Select.Portal>
      </Select.Root>

      <div class="header-right">
        <div class="master-dial" data-slop-export="hide">
          <label for="master-vol">Master</label>
          <Slider.Root
            type="single"
            bind:value={doc.current.master}
            min={0}
            max={100}
            step={1}
            class="master-slider-root"
            aria-label="Master volume"
          >
            {#snippet children({ thumbs })}
              <span class="master-track">
                <Slider.Range class="master-range" />
              </span>
              {#each thumbs as index}
                <Slider.Thumb {index} class="master-thumb" aria-label="Master volume" />
              {/each}
            {/snippet}
          </Slider.Root>
        </div>

        <button
          type="button"
          class="power-btn"
          class:active={doc.current.playing}
          onclick={togglePower}
          aria-label={doc.current.playing ? "Pause mix" : "Play mix"}
        >
          <Power size={16} />
        </button>
      </div>
    </header>

    <!-- Faders Deck -->
    <section class="faders-deck" aria-label="Audio channel faders">
      {#each CHANNELS as ch}
        {@const level = doc.current.channels[ch.id]}
        {@const isMuted = doc.current.muted[ch.id]}
        {@const IconComp = ch.icon}
        <div class="channel-strip">
          <div class="channel-info">
            <div class="channel-icon"><IconComp size={15} /></div>
            <span class="channel-name">{ch.label}</span>
          </div>

          <div class="fader-well">
            <Slider.Root
              type="single"
              bind:value={doc.current.channels[ch.id]}
              min={0}
              max={100}
              step={1}
              orientation="vertical"
              class="channel-slider"
              aria-label="{ch.label} volume"
            >
              {#snippet children({ thumbs })}
                <span class="fader-groove">
                  <Slider.Range class="fader-range" />
                </span>
                {#each thumbs as index}
                  <Slider.Thumb {index} class="fader-cap-thumb" aria-label="{ch.label} level">
                    <span class="fader-cap-line"></span>
                  </Slider.Thumb>
                {/each}
              {/snippet}
            </Slider.Root>
          </div>

          <div class="channel-bottom">
            <span class="channel-level">{level}%</span>
            <button
              type="button"
              class="mute-btn"
              class:muted={isMuted}
              onclick={() => toggleMute(ch.id)}
            >
              {isMuted ? "MUTED" : "MUTE"}
            </button>
          </div>
        </div>
      {/each}
    </section>

    <!-- Footer VU Meter -->
    <footer class="mixer-footer">
      <div class="vu-meter-row" aria-label="VU level meter">
        {#each Array(10) as _, index}
          <span
            class="vu-segment"
            class:lit-green={index < vuLevel && index < 6}
            class:lit-amber={index < vuLevel && index >= 6 && index < 8}
            class:lit-red={index < vuLevel && index >= 8}
          ></span>
        {/each}
      </div>
      <span class="footer-brand">HITSLOP HI-FI AMBIENT</span>
    </footer>
  </article>
</main>

{#if capture.isRenderer()}
  <Icon />
{/if}
