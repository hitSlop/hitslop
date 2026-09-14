<script lang="ts">
  let {
    bpm,
    tempo,
    signature,
    muted,
    beatsPerBar,
    weight,
  }: {
    bpm: number;
    tempo: string;
    signature: string;
    muted: boolean;
    beatsPerBar: number;
    weight: string;
  } = $props();
</script>

<main class="metronome-shell" aria-label="Exported metronome">
  <header class="chassis-head">
    <span class="screw" aria-hidden="true"></span>
    <p>PRECISION TEMPO</p>
    <span class="screw" aria-hidden="true"></span>
  </header>

  <section class="display-card">
    <div class="display-readout">
      <strong class="bpm-digits">{bpm}</strong>
      <span class="bpm-unit">BPM</span>
    </div>
    <p class="tempo-descriptor">{tempo}</p>
    <div class="beat-lights" aria-label={`${beatsPerBar} beats per bar`}>
      {#each Array(beatsPerBar) as _, index}
        <span class="beat-dot" class:accent={index === 0}></span>
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
    <div class="pendulum-arm" style:transform="rotate(-16deg)" style:--weight={weight}>
      <div class="brass-rod"></div>
      <div class="brass-weight"><i></i></div>
      <div class="pendulum-pivot"></div>
    </div>
  </section>

  <section class="controls-panel">
    <div class="settings-row">
      <div class="time-sig-selector" aria-label="Time signature">
        {#each ["2/4", "3/4", "4/4", "6/8"] as value}
          <span class="sig-btn" data-state={signature === value ? "checked" : undefined}>{value}</span>
        {/each}
      </div>
      <span class="mute-toggle" data-state={muted ? "on" : undefined}>{muted ? "MUTE" : "CLICK"}</span>
    </div>
  </section>
</main>
