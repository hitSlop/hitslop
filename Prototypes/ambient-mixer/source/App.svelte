<script lang="ts">
  import { jsonStore } from "@slop/svelte";
  import { Slider, Switch, Toolbar } from "bits-ui";
  import CloudRain from "@lucide/svelte/icons/cloud-rain";
  import Coffee from "@lucide/svelte/icons/coffee";
  import Disc3 from "@lucide/svelte/icons/disc-3";
  import Pause from "@lucide/svelte/icons/pause";
  import Play from "@lucide/svelte/icons/play";
  import Volume2 from "@lucide/svelte/icons/volume-2";

  type Texture = "soft" | "grain" | "pulse";
  type ChannelID = "rain" | "cafe" | "vinyl";
  type MixerData = {
    playing: boolean;
    texture: Texture;
    master: number;
    channels: Record<ChannelID, number>;
  };

  const defaults: MixerData = {
    playing: false,
    texture: "soft",
    master: 72,
    channels: { rain: 68, cafe: 42, vinyl: 24 },
  };

  const mixer = jsonStore<MixerData>("state", defaults);
  const channels = [
    { id: "rain" as const, label: "Rain", number: "01", icon: CloudRain },
    { id: "cafe" as const, label: "Café", number: "02", icon: Coffee },
    { id: "vinyl" as const, label: "Vinyl", number: "03", icon: Disc3 },
  ];

  let playing = $state(defaults.playing);
  let texture = $state<Texture>(defaults.texture);
  let master = $state(defaults.master);
  let levels = $state<Record<ChannelID, number>>({ ...defaults.channels });
  let appliedRevision = $state<string | null>(null);

  const mixLevel = $derived(
    Math.round(
      ((levels.rain * 0.46 + levels.cafe * 0.34 + levels.vinyl * 0.2) * master) / 100
    )
  );
  const waveformPath = $derived(
    texture === "soft"
      ? "M2 50 C20 16 39 16 57 50 S94 84 112 50 S149 16 168 50 S205 84 222 50"
      : texture === "grain"
        ? "M2 52 L16 24 L28 72 L42 34 L56 62 L70 18 L84 76 L100 38 L114 66 L128 28 L144 72 L158 22 L174 64 L190 34 L206 70 L222 48"
        : "M2 68 L28 68 L28 26 L58 26 L58 74 L90 74 L90 38 L120 38 L120 18 L152 18 L152 62 L184 62 L184 32 L222 32"
  );

  $effect(() => {
    const revision = mixer.revision;
    if (!revision || revision === appliedRevision) return;
    const next = mixer.current;
    playing = Boolean(next.playing);
    texture = ["soft", "grain", "pulse"].includes(next.texture) ? next.texture : "soft";
    master = clamp(next.master);
    levels = {
      rain: clamp(next.channels?.rain),
      cafe: clamp(next.channels?.cafe),
      vinyl: clamp(next.channels?.vinyl),
    };
    appliedRevision = revision;
  });

  function clamp(value: number | undefined): number {
    return Math.max(0, Math.min(100, Number(value) || 0));
  }

  function setPlaying(next: boolean): void {
    playing = next;
    mixer.update((data) => { data.playing = next; });
  }

  function setTexture(next: string): void {
    if (!next || !["soft", "grain", "pulse"].includes(next)) return;
    texture = next as Texture;
    mixer.update((data) => { data.texture = texture; });
  }

  function previewMaster(next: number): void {
    master = clamp(next);
  }

  function saveMaster(next: number): void {
    master = clamp(next);
    mixer.update((data) => { data.master = master; });
  }

  function previewChannel(id: ChannelID, next: number): void {
    levels[id] = clamp(next);
  }

  function saveChannel(id: ChannelID, next: number): void {
    levels[id] = clamp(next);
    mixer.update((data) => { data.channels[id] = levels[id]; });
  }

  function barHeight(index: number): number {
    const contour = [0.45, 0.72, 0.92, 0.62, 0.84, 1, 0.7, 0.88, 0.55, 0.76, 0.96, 0.66, 0.5][index];
    return Math.max(12, Math.round(mixLevel * contour));
  }
</script>

<main
  class="mixer-shell"
  data-playing={playing ? "true" : "false"}
  data-slop-selection="none"
  style={`--rain-level:${levels.rain}%; --cafe-level:${levels.cafe}%; --vinyl-level:${levels.vinyl}%`}
>
  <header class="mixer-header">
    <div class="identity">
      <span class="serial">LT—AM / 001</span>
      <h1>Room tone</h1>
    </div>

    <div class="power-cluster">
      <span>{playing ? "Live mix" : "Standing by"}</span>
      <Switch.Root
        checked={playing}
        onCheckedChange={setPlaying}
        aria-label={playing ? "Pause ambient mix" : "Play ambient mix"}
        class="power-switch data-[state=checked]:bg-[var(--mixer-coral)] data-[state=unchecked]:bg-[var(--mixer-shell-soft)]"
      >
        <Switch.Thumb class="power-thumb data-[state=checked]:translate-x-[27px]">
          {#if playing}
            <Pause class="size-[12px]" strokeWidth={2} fill="currentColor" absoluteStrokeWidth />
          {:else}
            <Play class="ml-px size-[12px]" strokeWidth={2} fill="currentColor" absoluteStrokeWidth />
          {/if}
        </Switch.Thumb>
      </Switch.Root>
    </div>
  </header>

  <section class="signal-stage" aria-label={`Current mix level ${mixLevel} percent`}>
    <div class="signal-readout">
      <span>Output</span>
      <strong>{String(mixLevel).padStart(2, "0")}</strong>
      <small>%</small>
    </div>

    <Toolbar.Root class="texture-toolbar" aria-label="Signal texture">
      <Toolbar.Group
        type="single"
        value={texture}
        onValueChange={setTexture}
        class="texture-group"
      >
        <Toolbar.GroupItem
          value="soft"
          aria-label="Soft waveform"
          class="texture-button data-[state=on]:bg-[var(--mixer-blue-ink)] data-[state=on]:text-[var(--mixer-blue)]"
        >
          <svg class="size-[17px]" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M2 12c3.2-8 6.8-8 10 0s6.8 8 10 0" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" />
          </svg>
        </Toolbar.GroupItem>
        <Toolbar.GroupItem
          value="grain"
          aria-label="Grain waveform"
          class="texture-button data-[state=on]:bg-[var(--mixer-blue-ink)] data-[state=on]:text-[var(--mixer-blue)]"
        >
          <svg class="size-[17px]" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="m2 16 5-8 5 8 5-8 5 8" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </Toolbar.GroupItem>
        <Toolbar.GroupItem
          value="pulse"
          aria-label="Pulse waveform"
          class="texture-button data-[state=on]:bg-[var(--mixer-blue-ink)] data-[state=on]:text-[var(--mixer-blue)]"
        >
          <svg class="size-[17px]" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M2 16h5V8h5v8h5V8h5" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </Toolbar.GroupItem>
      </Toolbar.Group>
    </Toolbar.Root>

    <div class="meter-bank" aria-hidden="true">
      {#each Array(13) as _, index}
        <span style={`--bar-height:${barHeight(index)}%`}></span>
      {/each}
    </div>

    <svg class="signal-wave" viewBox="0 0 224 100" fill="none" aria-hidden="true">
      <path class="wave-shadow" d={waveformPath} pathLength="1" />
      <path class="wave-line" d={waveformPath} pathLength="1" />
    </svg>
    <span class="signal-caption">Three rooms / one atmosphere</span>
  </section>

  <section class="control-deck" aria-label="Ambient channels">
    <div class="deck-heading">
      <span>Channels</span>
      <span>Hold the room gently</span>
    </div>

    <div class="channel-grid">
      {#each channels as channel}
        {@const Icon = channel.icon}
        <article class="channel" data-channel={channel.id}>
          <div class="channel-meta">
            <span>{channel.number}</span>
            <Icon class="size-[17px]" strokeWidth={1.75} absoluteStrokeWidth />
          </div>

          <Slider.Root
            type="single"
            orientation="vertical"
            min={0}
            max={100}
            step={1}
            value={levels[channel.id]}
            onValueChange={(value) => previewChannel(channel.id, value)}
            onValueCommit={(value) => saveChannel(channel.id, value)}
            class="channel-slider"
            aria-label={`${channel.label} level`}
            trackPadding={4}
          >
            <span class="channel-track">
              <Slider.Range class="channel-range" />
            </span>
            <Slider.Thumb
              index={0}
              class="channel-thumb focus-visible:outline-[3px] focus-visible:outline-offset-[3px] focus-visible:outline-[var(--mixer-focus)]"
              aria-label={`${channel.label}: ${levels[channel.id]} percent`}
            />
          </Slider.Root>

          <div class="channel-label">
            <strong>{channel.label}</strong>
            <span>{String(levels[channel.id]).padStart(2, "0")}</span>
          </div>
        </article>
      {/each}
    </div>
  </section>

  <footer class="master-strip">
    <div class="master-label">
      <Volume2 class="size-[18px]" strokeWidth={1.75} absoluteStrokeWidth />
      <span>Master</span>
    </div>
    <Slider.Root
      type="single"
      min={0}
      max={100}
      step={1}
      value={master}
      onValueChange={previewMaster}
      onValueCommit={saveMaster}
      class="master-slider"
      aria-label="Master output level"
    >
      <span class="master-track">
        <Slider.Range class="master-range" />
      </span>
      <Slider.Thumb
        index={0}
        class="master-thumb focus-visible:outline-[3px] focus-visible:outline-offset-[3px] focus-visible:outline-[var(--mixer-focus)]"
        aria-label={`Master: ${master} percent`}
      />
    </Slider.Root>
    <strong>{master}</strong>
  </footer>

  {#if mixer.error}
    <p class="mixer-error">Settings could not be saved.</p>
  {/if}
</main>
