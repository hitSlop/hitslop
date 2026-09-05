<script lang="ts">
  import { capture, ready } from "@hitslop/runtime";
  import { jsonStore } from "@hitslop/svelte";
  import Play from "@lucide/svelte/icons/play";
  import Square from "@lucide/svelte/icons/square";
  import Volume2 from "@lucide/svelte/icons/volume-2";
  import VolumeX from "@lucide/svelte/icons/volume-x";
  import { Slider, RadioGroup, Toggle } from "bits-ui";
  import { onDestroy, onMount } from "svelte";
  import Icon from "./Icon.svelte";
  import metronomeSchema, { type TimeSignature } from "../schema";

  const SIGNATURES: TimeSignature[] = ["2/4", "3/4", "4/4", "6/8"];
  const DEFAULT_PRESETS = [60, 90, 120, 140];

  const store = jsonStore({
    schema: metronomeSchema,
    initial: {
      bpm: 120,
      signature: "4/4",
      volume: 0.75,
      muted: false,
      presets: [...DEFAULT_PRESETS],
    },
  });

  let isPlaying = $state(false);
  let currentBeat = $state(0);
  let tapTimes: number[] = [];
  let lastTapTime = 0;
  let tapFeedback = $state(false);
  let tapCount = $state(0);
  let audioCtx: AudioContext | null = null;
  let timerId: number | null = null;
  let nextNoteTime = 0;
  let nextBeatNumber = 0;
  let noiseBuffer: AudioBuffer | null = null;

  const beatsPerBar = $derived(Number.parseInt(store.current.signature.split("/")[0] ?? "4", 10));
  const tempoName = $derived.by(() => {
    const bpm = store.current.bpm;
    if (bpm < 60) return "Largo";
    if (bpm < 76) return "Adagio";
    if (bpm < 108) return "Andante";
    if (bpm < 120) return "Moderato";
    if (bpm < 156) return "Allegro";
    if (bpm < 200) return "Vivace";
    return "Presto";
  });
  const swingSeconds = $derived(60 / Math.max(40, store.current.bpm));

  function getAudioContext(): AudioContext {
    if (!audioCtx) {
      const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      audioCtx = new AudioCtxClass();
    }
    if (audioCtx.state === "suspended") void audioCtx.resume();
    return audioCtx;
  }

  function getNoiseBuffer(ctx: AudioContext): AudioBuffer {
    if (noiseBuffer && noiseBuffer.sampleRate === ctx.sampleRate) return noiseBuffer;
    const length = Math.floor(ctx.sampleRate * 0.08);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
    noiseBuffer = buffer;
    return buffer;
  }

  function playTick(time: number, isAccent: boolean): void {
    if (store.current.muted) return;
    try {
      const ctx = getAudioContext();
      const vol = Math.max(0.02, store.current.volume);
      const noise = ctx.createBufferSource();
      noise.buffer = getNoiseBuffer(ctx);
      const filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.setValueAtTime(isAccent ? 1750 : 920, time);
      filter.Q.setValueAtTime(isAccent ? 3.2 : 7.5, time);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(vol * (isAccent ? 0.9 : 0.55), time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + (isAccent ? 0.045 : 0.028));
      noise.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      noise.start(time);
      noise.stop(time + 0.06);

      if (isAccent) {
        const osc = ctx.createOscillator();
        const oscGain = ctx.createGain();
        osc.type = "triangle";
        osc.frequency.setValueAtTime(2100, time);
        osc.frequency.exponentialRampToValueAtTime(780, time + 0.03);
        oscGain.gain.setValueAtTime(vol * 0.35, time);
        oscGain.gain.exponentialRampToValueAtTime(0.001, time + 0.04);
        osc.connect(oscGain);
        oscGain.connect(ctx.destination);
        osc.start(time);
        osc.stop(time + 0.045);
      }
    } catch {
      // Audio context may be blocked until a gesture.
    }
  }

  function scheduler(): void {
    const ctx = getAudioContext();
    while (nextNoteTime < ctx.currentTime + 0.1) {
      const beat = nextBeatNumber;
      const accent = store.current.signature === "6/8" ? beat === 0 || beat === 3 : beat === 0;
      playTick(nextNoteTime, accent);
      const delayMs = Math.max(0, (nextNoteTime - ctx.currentTime) * 1000);
      const capturedBeat = beat;
      setTimeout(() => {
        if (!isPlaying) return;
        currentBeat = capturedBeat;
      }, delayMs);
      const secondsPerBeat = store.current.signature === "6/8"
        ? 60 / store.current.bpm / 2
        : 60 / store.current.bpm;
      nextNoteTime += secondsPerBeat;
      nextBeatNumber = (nextBeatNumber + 1) % beatsPerBar;
    }
  }

  function start(): void {
    const ctx = getAudioContext();
    isPlaying = true;
    currentBeat = 0;
    nextBeatNumber = 0;
    nextNoteTime = ctx.currentTime + 0.05;
    timerId = window.setInterval(scheduler, 25);
  }

  function stop(): void {
    isPlaying = false;
    if (timerId !== null) {
      clearInterval(timerId);
      timerId = null;
    }
    currentBeat = 0;
  }

  function togglePlay(): void {
    if (isPlaying) stop();
    else start();
  }

  function setBpm(value: number): void {
    store.current.bpm = Math.min(240, Math.max(40, Math.round(value)));
  }

  function nudgeBpm(delta: number): void {
    setBpm(store.current.bpm + delta);
  }

  function handleTap(): void {
    const nowTime = performance.now();
    tapFeedback = true;
    window.setTimeout(() => { tapFeedback = false; }, 100);
    if (nowTime - lastTapTime > 2500) {
      tapTimes = [];
      tapCount = 0;
    }
    lastTapTime = nowTime;
    tapTimes.push(nowTime);
    tapCount = tapTimes.length;
    if (tapTimes.length > 6) tapTimes.shift();
    if (tapTimes.length >= 2) {
      let totalDelta = 0;
      for (let i = 1; i < tapTimes.length; i += 1) totalDelta += tapTimes[i]! - tapTimes[i - 1]!;
      setBpm(60000 / (totalDelta / (tapTimes.length - 1)));
    }
  }

  function savePreset(): void {
    const bpm = store.current.bpm;
    if (store.current.presets.includes(bpm)) return;
    store.current.presets = [...store.current.presets, bpm].sort((a, b) => a - b).slice(0, 6);
  }

  function removePreset(bpm: number): void {
    if (store.current.presets.length <= 1) return;
    store.current.presets = store.current.presets.filter((value) => value !== bpm);
  }

  function handleKeyDown(event: KeyboardEvent): void {
    if (event.target instanceof HTMLInputElement) return;
    if (event.code === "Space") {
      event.preventDefault();
      togglePlay();
    } else if (event.code === "KeyT") {
      event.preventDefault();
      handleTap();
    } else if (event.code === "ArrowUp") {
      event.preventDefault();
      nudgeBpm(event.shiftKey ? 5 : 1);
    } else if (event.code === "ArrowDown") {
      event.preventDefault();
      nudgeBpm(event.shiftKey ? -5 : -1);
    }
  }

  onMount(() => {
    window.addEventListener("keydown", handleKeyDown);
  });

  onDestroy(() => {
    window.removeEventListener("keydown", handleKeyDown);
    stop();
    if (audioCtx) void audioCtx.close();
    store.destroy();
  });

  $effect(() => {
    if (!store.isLoading) ready();
  });
</script>

<main class="metronome-shell" data-slop-selection="none">
  <header class="chassis-head">
    <span class="screw" aria-hidden="true"></span>
    <p>PRECISION TEMPO</p>
    <span class="screw" aria-hidden="true"></span>
  </header>

  <section class="display-card">
    <div class="display-readout">
      <strong class="bpm-digits">{store.current.bpm}</strong>
      <span class="bpm-unit">BPM</span>
    </div>
    <p class="tempo-descriptor">{tempoName}</p>
    <div class="beat-lights" aria-label={`Beat ${currentBeat + 1} of ${beatsPerBar}`}>
      {#each Array(beatsPerBar) as _, index}
        <span class="beat-dot" class:active={isPlaying && currentBeat === index} class:accent={index === 0}></span>
      {/each}
    </div>
  </section>

  <section class="pendulum-chamber" aria-hidden="true">
    <div class="scale-grooves">
      <span>200</span>
      <span>160</span>
      <span>120</span>
      <span>90</span>
      <span>60</span>
    </div>
    <div
      class="pendulum-arm"
      class:swinging={isPlaying}
      style:--speed="{swingSeconds}s"
      style:--weight="{((store.current.bpm - 40) / 200) * 58 + 18}%"
    >
      <div class="brass-rod"></div>
      <div class="brass-weight"><i></i></div>
      <div class="pendulum-pivot"></div>
    </div>
  </section>

  <section class="controls-panel">
    <div class="preset-row" data-slop-export="hide">
      {#each store.current.presets as preset (preset)}
        <button
          type="button"
          class="preset-btn"
          class:selected={store.current.bpm === preset}
          onclick={() => setBpm(preset)}
          ondblclick={() => removePreset(preset)}
        >
          {preset}
        </button>
      {/each}
      <button type="button" class="preset-save" onclick={savePreset} aria-label="Save current tempo">Save</button>
    </div>

    <div class="tempo-nudge-row" data-slop-export="hide">
      <button type="button" class="nudge-btn" onclick={() => nudgeBpm(-5)} aria-label="Subtract 5 BPM">-5</button>
      <button type="button" class="nudge-btn" onclick={() => nudgeBpm(-1)} aria-label="Subtract 1 BPM">-1</button>
      <Slider.Root
        type="single"
        bind:value={store.current.bpm}
        min={40}
        max={240}
        step={1}
        class="bpm-slider-root"
        aria-label="Tempo"
      >
        {#snippet children({ thumbs })}
          <span class="bpm-slider-track">
            <Slider.Range class="bpm-slider-range" />
          </span>
          {#each thumbs as index}
            <Slider.Thumb {index} class="bpm-slider-thumb" aria-label="Tempo" />
          {/each}
        {/snippet}
      </Slider.Root>
      <button type="button" class="nudge-btn" onclick={() => nudgeBpm(1)} aria-label="Add 1 BPM">+1</button>
      <button type="button" class="nudge-btn" onclick={() => nudgeBpm(5)} aria-label="Add 5 BPM">+5</button>
    </div>

    <div class="settings-row">
      <RadioGroup.Root
        value={store.current.signature}
        onValueChange={(v) => { if (v) { store.current.signature = v as TimeSignature; currentBeat = 0; nextBeatNumber = 0; } }}
        class="time-sig-selector"
        aria-label="Time signature"
      >
        {#each SIGNATURES as signature}
          <RadioGroup.Item
            value={signature}
            class="sig-btn"
          >
            {signature}
          </RadioGroup.Item>
        {/each}
      </RadioGroup.Root>
      <label class="volume-field" data-slop-export="hide">
        {#if store.current.muted}
          <VolumeX size={15} />
        {:else}
          <Volume2 size={15} />
        {/if}
        <Slider.Root
          type="single"
          bind:value={store.current.volume}
          min={0}
          max={1}
          step={0.01}
          class="volume-slider-root"
          aria-label="Click volume"
        >
          {#snippet children({ thumbs })}
            <span class="volume-slider-track">
              <Slider.Range class="volume-slider-range" />
            </span>
            {#each thumbs as index}
              <Slider.Thumb {index} class="volume-slider-thumb" aria-label="Click volume" />
            {/each}
          {/snippet}
        </Slider.Root>
      </label>
      <Toggle.Root
        pressed={store.current.muted}
        onPressedChange={(p) => { store.current.muted = p; }}
        class="mute-toggle"
        aria-label={store.current.muted ? "Unmute click" : "Mute click"}
      >
        {store.current.muted ? "MUTE" : "CLICK"}
      </Toggle.Root>
    </div>

    <div class="primary-actions" data-slop-export="hide">
      <button
        type="button"
        class="tap-tempo-btn"
        class:tap-active={tapFeedback}
        onclick={handleTap}
        aria-label="Tap tempo four times"
      >
        <span>TAP TEMPO</span>
        <strong>TAP 4×</strong>
        <em>{tapCount > 0 ? `${Math.min(tapCount, 4)} / 4` : "listen"}</em>
      </button>
      <button
        type="button"
        class="play-toggle-btn"
        class:playing={isPlaying}
        onclick={togglePlay}
        aria-label={isPlaying ? "Stop metronome" : "Start metronome"}
      >
        {#if isPlaying}
          <Square size={22} fill="currentColor" />
        {:else}
          <Play size={24} fill="currentColor" class="play-icon-offset" />
        {/if}
      </button>
    </div>
  </section>
</main>

{#if store.error}
  <p class="store-error">Tempo settings could not be saved.</p>
{/if}

{#if capture.isRenderer()}
  <Icon />
{/if}
