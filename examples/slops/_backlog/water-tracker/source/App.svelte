<script lang="ts">
  import { capture } from "@hitslop/runtime";
  import { jsonStore } from "@hitslop/svelte";
  import RotateCcw from "@lucide/svelte/icons/rotate-ccw";
  import { Progress } from "bits-ui";
  import Icon from "./Icon.svelte";

  type DrinkLog = {
    id: string;
    time: string;
    amount: number;
    label: string;
  };

  type WaterData = {
    target: number;
    current: number;
    unit: string;
    logs: DrinkLog[];
  };

  type Particle = {
    id: number;
    symbol: string;
    left: number;
    size: number;
    delay: number;
    duration: number;
  };

  const PARTICLES_POOL = ["💧", "✨", "🎉", "🌟", "🫧", "🌊", "💎", "💙"];

  const doc = jsonStore<WaterData>({
    target: 2500,
    current: 1750,
    unit: "ml",
    logs: [
      { id: "1", time: "08:30", amount: 250, label: "Morning Glass" },
      { id: "2", time: "11:00", amount: 500, label: "Desk Bottle" },
      { id: "3", time: "13:45", amount: 500, label: "Lunch Bottle" },
      { id: "4", time: "15:20", amount: 500, label: "Afternoon Bottle" },
    ],
  });

  const percent = $derived(
    doc.current.target > 0
      ? Math.min(100, Math.round((doc.current.current / doc.current.target) * 100))
      : 0
  );

  let particles = $state<Particle[]>([]);
  let hasCelebrated = $state(false);

  function triggerCelebration() {
    const list: Particle[] = [];
    for (let i = 0; i < 24; i++) {
      list.push({
        id: i,
        symbol: PARTICLES_POOL[Math.floor(Math.random() * PARTICLES_POOL.length)],
        left: Math.floor(Math.random() * 88) + 6,
        size: Math.floor(Math.random() * 12) + 16,
        delay: Math.round(Math.random() * 1200) / 1000,
        duration: Math.round((Math.random() * 1.5 + 2) * 10) / 10,
      });
    }
    particles = list;
    playCelebrationChime();
  }

  function playCelebrationChime() {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6 (crystal water chime)
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.09);
        gain.gain.setValueAtTime(0, ctx.currentTime + idx * 0.09);
        gain.gain.linearRampToValueAtTime(0.18, ctx.currentTime + idx * 0.09 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.09 + 0.55);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + idx * 0.09);
        osc.stop(ctx.currentTime + idx * 0.09 + 0.6);
      });
    } catch {
      // AudioContext might be guarded until interaction
    }
  }

  $effect(() => {
    if (percent >= 100 && !hasCelebrated) {
      hasCelebrated = true;
      triggerCelebration();
    } else if (percent < 100) {
      hasCelebrated = false;
      particles = [];
    }
  });

  function logIntake(amount: number, label: string) {
    const now = new Date();
    const time = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    doc.current.current += amount;
    doc.current.logs.unshift({
      id: crypto.randomUUID(),
      time,
      amount,
      label,
    });
  }

  function resetDay() {
    doc.current.current = 0;
    doc.current.logs = [];
    hasCelebrated = false;
    particles = [];
  }
</script>

<main class="hydration-canvas">
  <article class="flask-shell">
    <!-- Header -->
    <header class="flask-header">
      <span class="brand-tag">HYDRATION 01</span>
      <label class="target-row">
        <span>Target:</span>
        <input
          type="number"
          class="target-input"
          aria-label="Daily target intake"
          bind:value={doc.current.target}
        />
        <span>{doc.current.unit}</span>
      </label>
    </header>

    <!-- Liquid Vessel Chamber -->
    <Progress.Root
      value={Math.min(percent, 100)}
      max={100}
      class="liquid-chamber {percent >= 100 ? 'celebration' : ''}"
      aria-label="Liquid reservoir hydration progress"
    >
      <div
        class="liquid-body"
        style="height: {Math.max(4, percent)}%;"
      >
        <div class="liquid-wave" class:celebration={percent >= 100} aria-hidden="true"></div>
      </div>

      <!-- Confetti & Celebration Layer -->
      {#if percent >= 100}
        <div class="confetti-layer" aria-hidden="true">
          {#each particles as p (p.id)}
            <span
              class="confetti-particle"
              style="left: {p.left}%; font-size: {p.size}px; animation-delay: {p.delay}s; animation-duration: {p.duration}s;"
            >
              {p.symbol}
            </span>
          {/each}
        </div>
      {/if}

      <!-- Live Digital Readout -->
      <div class="readout-overlay" aria-live="polite">
        {#if percent >= 100}
          <button
            type="button"
            class="celebration-badge"
            aria-label="Goal achieved, tap to celebrate again"
            onclick={triggerCelebration}
          >
            <span>🎉</span>
            <span>GOAL REACHED!</span>
          </button>
        {/if}
        <strong class="intake-digits">{doc.current.current.toLocaleString()}</strong>
        <span class="intake-unit">{doc.current.unit}</span>
        <span class="intake-percent">{percent}% of daily goal</span>
      </div>
    </Progress.Root>

    <!-- Quick Log Action Buttons -->
    <section class="quick-tap-grid" data-slop-export="hide" aria-label="Quick log drinks">
      <button
        type="button"
        class="tap-btn"
        onclick={() => logIntake(200, "Small Glass")}
      >
        <span class="tap-amount">+200</span>
        <span class="tap-label">Small Glass</span>
      </button>

      <button
        type="button"
        class="tap-btn"
        onclick={() => logIntake(250, "Glass")}
      >
        <span class="tap-amount">+250</span>
        <span class="tap-label">Glass</span>
      </button>

      <button
        type="button"
        class="tap-btn"
        onclick={() => logIntake(500, "Bottle")}
      >
        <span class="tap-amount">+500</span>
        <span class="tap-label">Bottle</span>
      </button>

      <button
        type="button"
        class="tap-btn"
        onclick={() => logIntake(750, "Flask")}
      >
        <span class="tap-amount">+750</span>
        <span class="tap-label">Flask</span>
      </button>
    </section>

    <!-- Footer History & Reset -->
    <footer class="history-row">
      <span>{doc.current.logs.length} drinks logged today</span>
      <button
        type="button"
        class="reset-btn"
        data-slop-export="hide"
        onclick={resetDay}
        aria-label="Reset today's water intake"
      >
        Reset
      </button>
    </footer>
  </article>
</main>

{#if capture.isRenderer()}
  <Icon />
{/if}
