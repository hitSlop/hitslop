<script lang="ts">
  import { onMount } from "svelte";

  let kind = $state<"focus" | "rest">("focus");
  let remaining = $state(25 * 60);
  let running = $state(false);
  let completed = $state(0);
  let tick: ReturnType<typeof setInterval> | undefined;

  const duration = $derived((kind === "focus" ? 25 : 5) * 60);
  const progress = $derived(1 - remaining / duration);
  const label = $derived(`${String(Math.floor(remaining / 60)).padStart(2, "0")}:${String(remaining % 60).padStart(2, "0")}`);

  function stop(): void {
    if (tick) clearInterval(tick);
    tick = undefined;
    running = false;
  }

  function toggle(): void {
    if (running) {
      stop();
      return;
    }
    running = true;
    tick = setInterval(() => {
      if (remaining > 1) {
        remaining -= 1;
        return;
      }
      stop();
      if (kind === "focus") completed += 1;
      kind = kind === "focus" ? "rest" : "focus";
      remaining = kind === "focus" ? 25 * 60 : 5 * 60;
    }, 1000);
  }

  function reset(): void {
    stop();
    remaining = duration;
  }

  function selectKind(next: "focus" | "rest"): void {
    stop();
    kind = next;
    remaining = next === "focus" ? 25 * 60 : 5 * 60;
  }

  onMount(() => () => stop());
</script>

<div class="timer-shell" data-kind={kind} data-running={running}>
  <div class="leaf" aria-hidden="true"><i></i><i></i><i></i></div>
  <output class="completed" aria-label={`${completed} completed focus sessions`}><span aria-hidden="true">🍅</span>{completed}</output>

  <div class="mode" role="group" aria-label="Timer mode">
    <button type="button" class:active={kind === "focus"} onclick={() => selectKind("focus")}>Focus</button>
    <button type="button" class:active={kind === "rest"} onclick={() => selectKind("rest")}>Rest</button>
  </div>

  <section class="dial" aria-label={`${kind} timer, ${label} remaining`}>
    <svg viewBox="0 0 120 120" aria-hidden="true">
      <circle class="track" cx="60" cy="60" r="47"></circle>
      <circle class="progress" cx="60" cy="60" r="47" pathLength="1" stroke-dasharray="1" stroke-dashoffset={1 - Math.max(0, progress)}></circle>
    </svg>
    <div class="readout" aria-live="polite"><strong>{label}</strong><small>{kind === "focus" ? "deep work" : "take a breath"}</small></div>
  </section>

  <div class="controls">
    <button class="run" type="button" onclick={toggle}><span aria-hidden="true">{running ? "Ⅱ" : "▶"}</span>{running ? "Pause" : "Start"}</button>
    <button class="reset" type="button" onclick={reset} aria-label="Reset timer">↺</button>
  </div>
  <p>Interactive demo · resets on refresh</p>
</div>

<style>
  :global(*) { box-sizing: border-box; }
  button { font: inherit; }
  .timer-shell {
    --tomato: oklch(70% 0.18 35);
    --tomato-deep: oklch(54% 0.2 31);
    --cream: oklch(96% 0.055 91);
    --ink: oklch(24% 0.035 32);
    --leaf: oklch(54% 0.12 140);
    position: relative;
    width: min(100%, 390px);
    aspect-ratio: 1;
    padding: 14% 13% 10%;
    display: grid;
    grid-template-rows: auto minmax(0, 1fr) auto auto;
    justify-items: center;
    color: var(--ink);
    background: var(--tomato);
    border: 7px solid var(--ink);
    border-radius: 50%;
    box-shadow: inset 0 0 0 7px oklch(80% 0.12 42), 0 20px 42px oklch(31% 0.06 31 / 0.24);
    container-type: inline-size;
    overflow: hidden;
  }
  .timer-shell[data-kind="rest"] { --tomato: oklch(80% 0.085 213); --tomato-deep: oklch(54% 0.1 213); }
  .leaf { position: absolute; z-index: 2; top: 1.5%; left: 50%; width: 19%; height: 14%; transform: translateX(-50%); }
  .leaf i { position: absolute; bottom: 0; width: 42%; height: 88%; background: var(--leaf); border-radius: 100% 0; transform-origin: bottom; }
  .leaf i:first-child { left: 29%; transform: rotate(-4deg); }
  .leaf i:nth-child(2) { left: 5%; transform: rotate(-48deg) scale(.82); }
  .leaf i:nth-child(3) { right: 5%; transform: rotate(47deg) scale(.82); }
  .completed { position: absolute; right: 13%; top: 12%; min-width: 34px; height: 24px; padding: 0 7px; display: flex; align-items: center; justify-content: center; gap: 4px; border: 2px solid var(--ink); border-radius: 999px; background: var(--cream); font-size: 10px; font-weight: 800; }
  .mode { display: flex; align-items: center; gap: 4px; padding: 3px; border: 2px solid color-mix(in oklch, var(--ink), transparent 58%); border-radius: 999px; }
  .mode button { min-height: 28px; padding: 0 11px; border: 0; border-radius: 999px; color: color-mix(in oklch, var(--ink), transparent 25%); background: transparent; font-size: 10px; font-weight: 800; cursor: pointer; }
  .mode button.active { color: var(--cream); background: var(--ink); }
  .dial { position: relative; align-self: center; width: min(100%, 225px); aspect-ratio: 1; border: 6px solid var(--ink); border-radius: 50%; background: var(--cream); box-shadow: 6px 8px oklch(28% 0.04 31 / 0.2); }
  svg { width: 100%; height: 100%; padding: 13px; transform: rotate(-90deg); }
  circle { fill: none; stroke-width: 4; }
  .track { stroke: oklch(28% 0.04 31 / 0.12); }
  .progress { stroke: var(--tomato-deep); stroke-linecap: round; transition: stroke-dashoffset 500ms linear; }
  .readout { position: absolute; inset: 0; display: grid; place-content: center; text-align: center; }
  .readout strong { font-size: clamp(2.4rem, 15cqw, 4rem); line-height: .82; letter-spacing: -.08em; font-variant-numeric: tabular-nums; }
  .readout small { margin-top: 10px; font-size: 9px; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; }
  .controls { display: flex; align-items: center; gap: 8px; }
  .controls button { min-height: 42px; border: 3px solid var(--ink); color: var(--ink); cursor: pointer; box-shadow: 3px 4px oklch(28% 0.04 31 / 0.2); }
  .run { min-width: 112px; display: inline-flex; align-items: center; justify-content: center; gap: 7px; border-radius: 999px; background: oklch(86% 0.16 91); font-size: 11px; font-weight: 850; text-transform: uppercase; letter-spacing: .06em; }
  .reset { width: 42px; padding: 0; border-radius: 50%; background: var(--cream); font-size: 20px; }
  .controls button:active { transform: translate(2px, 2px); box-shadow: 1px 1px oklch(28% 0.04 31 / 0.2); }
  p { margin: 8px 0 0; color: color-mix(in oklch, var(--ink), transparent 26%); font-size: 8px; font-weight: 650; letter-spacing: .05em; }
  button:focus-visible { outline: 3px solid oklch(96% 0.04 92); outline-offset: 3px; }
  @container (width < 320px) {
    .timer-shell { padding-inline: 12%; }
    .dial { width: 185px; }
    .mode { display: none; }
  }
  @media (prefers-reduced-motion: reduce) { .progress { transition: none; } }
</style>
