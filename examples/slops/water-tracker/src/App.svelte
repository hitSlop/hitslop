<script lang="ts">
  import { capture, ready } from "@hitslop/runtime";
  import { jsonStore, IconTarget, ExportTarget } from "@hitslop/svelte";
  import { onDestroy, onMount, tick, untrack } from "svelte";
  import { Tween, prefersReducedMotion } from "svelte/motion";
  import { cubicOut } from "svelte/easing";
  import { Progress, Button } from "bits-ui";
  import waterSchema from "../schema";
  import Icon from "./Icon.svelte";
  import Export from "./Export.svelte";
  import * as s from "./styles.css";

  const QUICK = [
    { amount: 200, label: "Small glass" },
    { amount: 250, label: "Glass" },
    { amount: 500, label: "Bottle" },
    { amount: 750, label: "Flask" },
  ] as const;
  const PARTICLES = ["💧", "✨", "🎉", "🌟", "🫧", "🌊", "💎", "💙"];

  const doc = jsonStore({ schema: waterSchema, initial: {
    target: 2500,
    current: 1750,
    unit: "ml",
    logs: [
      { id: "morning", time: "08:30", amount: 250, label: "Morning glass" },
      { id: "desk", time: "11:00", amount: 500, label: "Desk bottle" },
      { id: "lunch", time: "13:45", amount: 500, label: "Lunch bottle" },
      { id: "afternoon", time: "15:20", amount: 500, label: "Afternoon bottle" },
    ],
  } });

  $effect(() => { if (doc.isReady) ready(); });
  const percent = $derived(doc.current.target > 0 ? Math.min(100, Math.round((doc.current.current / doc.current.target) * 100)) : 0);
  const fill = $derived(Math.max(4, percent));
  // Start at the current level; subsequent changes are handled by the effect.
  const liquid = new Tween(untrack(() => fill), { duration: 350, easing: cubicOut });
  let initialized = false;
  let particles = $state<Array<{ id: number; symbol: string; left: number; size: number; delay: number; duration: number }>>([]);
  let particleId = 0;
  let audio: AudioContext | undefined;
  let audioTimeout: ReturnType<typeof setTimeout> | undefined;

  $effect(() => {
    const instant = !initialized || !doc.isReady || prefersReducedMotion.current;
    void liquid.set(fill, { duration: instant ? 0 : 350, delay: 0 });
    initialized = doc.isReady;
  });

  $effect(() => {
    if (prefersReducedMotion.current || percent < 100) {
      particles = [];
      stopChime();
    }
  });

  onMount(() => capture.onPrepare(async () => {
    particles = [];
    stopChime();
    await liquid.set(fill, { duration: 0, delay: 0 });
    await tick();
  }));

  onDestroy(() => {
    void liquid.set(liquid.target, { duration: 0, delay: 0 });
    stopChime();
    doc.destroy();
  });

  function celebrate() {
    if (prefersReducedMotion.current) { particles = []; return; }
    particles = Array.from({ length: 24 }, (_, id) => ({
      id: particleId++,
      symbol: PARTICLES[id % PARTICLES.length]!,
      left: 6 + ((id * 17) % 88),
      size: 16 + (id % 12),
      delay: (id % 12) / 10,
      duration: 2 + (id % 15) / 10,
    }));
    chime();
  }

  function stopChime() {
    clearTimeout(audioTimeout);
    audioTimeout = undefined;
    const ctx = audio;
    audio = undefined;
    if (ctx && ctx.state !== "closed") void ctx.close().catch(() => undefined);
  }

  function chime() {
    stopChime();
    try {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      audio = ctx;
      // Also release a context that remained suspended by browser audio policy.
      audioTimeout = setTimeout(stopChime, 1500);
      [523.25, 659.25, 783.99, 1046.5].forEach((freq, index) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, ctx.currentTime + index * 0.09);
        gain.gain.setValueAtTime(0, ctx.currentTime + index * 0.09);
        gain.gain.linearRampToValueAtTime(0.18, ctx.currentTime + index * 0.09 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + index * 0.09 + 0.55);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + index * 0.09);
        osc.stop(ctx.currentTime + index * 0.09 + 0.6);
        if (index === 3) osc.onended = () => { if (audio === ctx) stopChime(); };
      });
    } catch { stopChime(); /* gesture-gated audio */ }
  }

  function logIntake(amount: number, label: string) {
    if (doc.isLoading) return;
    const now = new Date();
    const wasComplete = percent >= 100;
    doc.current.current += amount;
    doc.current.logs.unshift({
      id: crypto.randomUUID(),
      time: `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`,
      amount,
      label,
    });
    if (!wasComplete && percent >= 100) celebrate();
  }

  function resetDay() {
    doc.current.current = 0;
    doc.current.logs = [];
    particles = [];
    stopChime();
  }
</script>

<main class={s.flask} data-slop-selection="none" aria-busy={doc.isLoading} aria-label="Water tracker">
  <header class={s.header}>
    <span class={s.brand}>Hydration 01</span>
    <label class={s.target}>
      <span>Target</span>
      <input type="number" min="1" aria-label="Daily target intake" value={doc.current.target} oninput={event => { const next = Number((event.currentTarget as HTMLInputElement).value); if (Number.isFinite(next) && next > 0) doc.current.target = next; }} />
      <span>{doc.current.unit}</span>
    </label>
  </header>

  <Progress.Root value={Math.min(percent, 100)} max={100} class={s.chamber} data-complete={percent >= 100} aria-label="Daily hydration progress">
    <div class={s.liquid} style:transform={`translateY(${100 - liquid.current}%)`} aria-hidden="true">
      <div class={s.waveCap} data-complete={percent >= 100} aria-hidden="true"></div>
    </div>
    {#if percent >= 100 && particles.length}
      <div class={s.confetti} aria-hidden="true" data-slop-export="hide">
        {#each particles as particle (particle.id)}
          <span class={s.particle} onanimationend={() => { particles = particles.filter(item => item.id !== particle.id); }} style="left:{particle.left}%;font-size:{particle.size}px;animation-delay:{particle.delay}s;animation-duration:{particle.duration}s">{particle.symbol}</span>
        {/each}
      </div>
    {/if}
    <div class={s.readout} aria-live="polite">
      {#if percent >= 100}
        <button type="button" class={s.badge} data-slop-export="hide" aria-label="Goal reached, celebrate again" onclick={celebrate}>Goal reached</button>
      {/if}
      <strong class={s.digits}>{doc.current.current.toLocaleString()}</strong>
      <span class={s.unit}>{doc.current.unit}</span>
      <span class={s.percent}>{percent}% of daily goal</span>
    </div>
  </Progress.Root>

  <section class={s.taps} data-slop-export="hide" aria-label="Quick log drinks">
    {#each QUICK as drink}
      <Button.Root type="button" class={s.tap} onclick={() => logIntake(drink.amount, drink.label)}>
        <strong>+{drink.amount}</strong>
        <span>{drink.label}</span>
      </Button.Root>
    {/each}
  </section>

  <footer class={s.foot}>
    <span>{doc.current.logs.length ? `${doc.current.logs.length} drinks logged today` : "No drinks logged yet."}</span>
    <Button.Root type="button" data-slop-export="hide" onclick={resetDay} aria-label="Reset today's water intake">Reset</Button.Root>
  </footer>

  {#if doc.error}
    <div class={s.error} role="alert">
      <span>{doc.isReady ? "Changes haven’t been saved." : "Your flask couldn’t be loaded."} {doc.error}</span>
    </div>
  {:else if doc.isLoading}<p class={s.error} role="status">Loading your flask…</p>{/if}
</main>

<IconTarget><Icon percent={percent} /></IconTarget>
<ExportTarget><Export data={doc.current} percent={percent} /></ExportTarget>
