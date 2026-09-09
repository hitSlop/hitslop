<script lang="ts">
  type ThemePreset = {
    label: string;
    description: string;
    surface: string;
    paper: string;
    ink: string;
    muted: string;
    accent: string;
    onAccent: string;
    rule: string;
    control: string;
    highlight: string;
    heading: string;
  };

  const presets: ThemePreset[] = [
    {
      label: "Peach Paper", description: "Warm and softly printed", surface: "#e98996", paper: "#fff9f3",
      ink: "#432830", muted: "#82636a", accent: "#a43d59", onAccent: "#fff9f3", rule: "#ead9cb",
      control: "#f1dfc9", highlight: "#f8d65a", heading: 'Georgia, "Times New Roman", serif',
    },
    {
      label: "Blue Pencil", description: "Cool, crisp, and practical", surface: "#b8cef1", paper: "#f7faff",
      ink: "#172b52", muted: "#607394", accent: "#315fae", onAccent: "#f7faff", rule: "#ccd9ea",
      control: "#dce7f6", highlight: "#f1c958", heading: '"Onest", "Avenir Next", sans-serif',
    },
    {
      label: "Night Shift", description: "Dark plum with a bright pulse", surface: "#241a32", paper: "#352742",
      ink: "#f4efdf", muted: "#c4b7ca", accent: "#d3ed68", onAccent: "#202615", rule: "#594765",
      control: "#493755", highlight: "#f2b85b", heading: 'Georgia, "Times New Roman", serif',
    },
  ];

  let selected = $state(0);
  const active = $derived(presets[selected] ?? presets[0]!);
  const customProperties = $derived([
    `--theme-surface:${active.surface}`,
    `--theme-paper:${active.paper}`,
    `--theme-ink:${active.ink}`,
    `--theme-muted:${active.muted}`,
    `--theme-accent:${active.accent}`,
    `--theme-on-accent:${active.onAccent}`,
    `--theme-rule:${active.rule}`,
    `--theme-control:${active.control}`,
    `--theme-highlight:${active.highlight}`,
    `--theme-heading:${active.heading}`,
  ].join(";"));
</script>

<div class="theme-switcher" style={customProperties}>
  <div class="preset-bar">
    <div>
      <small>Choose a look</small>
      <strong>{active.label}</strong>
    </div>
    <div class="presets" role="group" aria-label="Theme presets">
      {#each presets as preset, index}
        <button type="button" aria-pressed={selected === index} aria-label={`${preset.label}: ${preset.description}`} onclick={() => selected = index}>
          <span style:background={preset.surface}></span><span style:background={preset.paper}></span><span style:background={preset.accent}></span>
          <b>{preset.label}</b>
        </button>
      {/each}
    </div>
  </div>

  <div class="preview-stage">
    <article class="checklist" aria-label={`${active.label} checklist preview`}>
      <div class="binding" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div>
      <header>
        <p>A little less on your mind.</p>
        <h3>Little things, today</h3>
        <div class="progress"><span>2 left to do</span><span>1 / 3 done</span></div>
        <div class="track"><i></i></div>
      </header>
      <div class="task done"><span aria-hidden="true">✓</span><p>Send the first draft</p><small>Done</small></div>
      <div class="task"><span aria-hidden="true"></span><p>Take a walk without my phone</p><small>Today</small></div>
      <div class="task"><span aria-hidden="true"></span><p>Make a little room for the weekend</p><small>Today</small></div>
      <footer><span>One list. Your colors.</span><b>＋</b></footer>
    </article>
  </div>

  <div class="theme-file">
    <span class="status-dot" aria-hidden="true"></span>
    <code>stores/theme.css</code>
    <span>Your override stays with this file</span>
  </div>
  <p class="sr-only" aria-live="polite">{active.label} theme selected.</p>
</div>

<style>
  :global(*) { box-sizing: border-box; }
  button { font: inherit; }
  .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
  .theme-switcher { width: min(100%, 720px); overflow: hidden; border: 1px solid color-mix(in oklch, var(--theme-ink), transparent 72%); border-radius: 22px; color: var(--theme-ink); background: var(--theme-paper); box-shadow: 13px 15px 0 color-mix(in oklch, var(--theme-ink), transparent 87%), 0 28px 70px oklch(18% .04 320 / .16); transition: color 240ms cubic-bezier(.22,1,.36,1), background-color 240ms cubic-bezier(.22,1,.36,1), border-color 240ms cubic-bezier(.22,1,.36,1); }
  .preset-bar { padding: 17px; display: grid; gap: 15px; border-bottom: 1px solid var(--theme-rule); background: color-mix(in oklch, var(--theme-paper), var(--theme-surface) 14%); transition: background-color 240ms cubic-bezier(.22,1,.36,1), border-color 240ms cubic-bezier(.22,1,.36,1); }
  .preset-bar > div:first-child { display: grid; align-content: center; gap: 1px; }
  .preset-bar small { color: var(--theme-muted); font-size: .57rem; font-weight: 750; letter-spacing: .1em; text-transform: uppercase; }
  .preset-bar strong { font-size: .86rem; }
  .presets { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 7px; }
  .presets button { min-width: 0; min-height: 48px; padding: 7px; display: grid; grid-template-columns: repeat(3, 12px); align-items: center; justify-content: center; gap: 3px; border: 1px solid transparent; border-radius: 9px; color: var(--theme-ink); background: transparent; cursor: pointer; }
  .presets button[aria-pressed="true"] { border-color: color-mix(in oklch, var(--theme-ink), transparent 60%); background: color-mix(in oklch, var(--theme-paper), var(--theme-ink) 6%); box-shadow: 0 3px 0 color-mix(in oklch, var(--theme-ink), transparent 80%); }
  .presets button > span { width: 12px; height: 12px; border: 1px solid oklch(30% .02 260 / .18); border-radius: 50%; }
  .presets b { grid-column: 1 / -1; overflow: hidden; font-size: .55rem; font-weight: 700; text-overflow: ellipsis; white-space: nowrap; }
  .preview-stage { min-height: 500px; padding: clamp(28px, 6vw, 54px); display: grid; place-items: center; background: var(--theme-surface); transition: background-color 240ms cubic-bezier(.22,1,.36,1); }
  .checklist { position: relative; width: min(100%, 430px); padding: 34px 30px 25px; border: 1px solid var(--theme-rule); border-radius: 6px; background: var(--theme-paper); box-shadow: 9px 11px 0 color-mix(in oklch, var(--theme-ink), transparent 82%), 0 24px 44px color-mix(in oklch, var(--theme-ink), transparent 83%); transform: rotate(-.65deg); transition: color 240ms cubic-bezier(.22,1,.36,1), background-color 240ms cubic-bezier(.22,1,.36,1), border-color 240ms cubic-bezier(.22,1,.36,1), box-shadow 240ms cubic-bezier(.22,1,.36,1); }
  .binding { position: absolute; top: -8px; left: 16%; right: 16%; display: flex; justify-content: space-between; }
  .binding i { width: 9px; height: 17px; border: 2px solid var(--theme-ink); border-bottom: 0; border-radius: 6px 6px 0 0; opacity: .58; }
  .checklist header { padding-bottom: 20px; border-bottom: 1px solid var(--theme-rule); }
  .checklist header > p { margin: 0 0 4px; color: var(--theme-muted); font-size: .57rem; font-weight: 750; letter-spacing: .08em; text-transform: uppercase; }
  .checklist h3 { margin: 0; font-family: var(--theme-heading); font-size: clamp(1.6rem, 5vw, 2.35rem); line-height: 1.05; letter-spacing: -.035em; }
  .progress { margin-top: 18px; display: flex; justify-content: space-between; color: var(--theme-muted); font-size: .61rem; font-weight: 650; }
  .track { height: 6px; margin-top: 8px; overflow: hidden; border-radius: 999px; background: var(--theme-control); }
  .track i { width: 33%; height: 100%; display: block; border-radius: inherit; background: var(--theme-accent); }
  .task { min-height: 58px; display: grid; grid-template-columns: 22px 1fr auto; align-items: center; gap: 11px; border-bottom: 1px solid var(--theme-rule); }
  .task > span { width: 20px; height: 20px; display: grid; place-items: center; border: 1px solid color-mix(in oklch, var(--theme-ink), transparent 42%); border-radius: 5px; font-size: .65rem; font-weight: 800; }
  .task.done > span { border-color: var(--theme-accent); color: var(--theme-on-accent); background: var(--theme-accent); }
  .task p { margin: 0; font-size: .72rem; font-weight: 650; }
  .task.done p { color: var(--theme-muted); text-decoration: line-through; }
  .task small { color: var(--theme-muted); font-size: .54rem; }
  .checklist footer { padding-top: 20px; display: flex; align-items: center; justify-content: space-between; color: var(--theme-muted); font-size: .58rem; }
  .checklist footer b { width: 32px; height: 32px; display: grid; place-items: center; border-radius: 50%; color: var(--theme-on-accent); background: var(--theme-accent); font-size: 1rem; }
  .theme-file { min-height: 54px; padding: 0 17px; display: grid; grid-template-columns: auto auto 1fr; align-items: center; gap: 9px; border-top: 1px solid var(--theme-rule); background: var(--theme-paper); }
  .theme-file .status-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--theme-accent); }
  .theme-file code { font-size: .63rem; font-weight: 700; }
  .theme-file > span:last-child { justify-self: end; color: var(--theme-muted); font-size: .57rem; }
  button:focus-visible { outline: 3px solid var(--theme-accent); outline-offset: 2px; }
  @media (min-width: 560px) {
    .preset-bar { grid-template-columns: 1fr minmax(330px, 1.5fr); }
  }
  @media (hover: hover) and (pointer: fine) {
    .presets button:hover { background: color-mix(in oklch, var(--theme-paper), var(--theme-ink) 5%); }
  }
  @media (max-width: 430px) {
    .preview-stage { min-height: 430px; padding: 27px 17px; }
    .checklist { padding-inline: 20px; }
    .theme-file { grid-template-columns: auto 1fr; }
    .theme-file > span:last-child { display: none; }
  }
  @media (prefers-reduced-motion: reduce) {
    .theme-switcher, .preset-bar, .preview-stage, .checklist { transition: none; }
  }
</style>
