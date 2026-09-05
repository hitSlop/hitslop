<script lang="ts">
  import { capture, ready } from "@hitslop/runtime";
  import { jsonStore } from "@hitslop/svelte";
  import { Tabs } from "bits-ui";
  import { onDestroy } from "svelte";
  import Pause from "@lucide/svelte/icons/pause";
  import Play from "@lucide/svelte/icons/play";
  import RotateCcw from "@lucide/svelte/icons/rotate-ccw";
  import timerSchema from "../schema";
  import Icon from "./Icon.svelte";

  type Kind = "focus" | "rest";
  const timer = jsonStore({ schema: timerSchema, initial: {
    focusMinutes: 25,
    restMinutes: 5,
    history: [],
  } });

  let kind = $state<Kind>("focus");
  let remaining = $state(25 * 60);
  let running = $state(false);
  let tick: ReturnType<typeof setInterval> | null = null;

  const duration = $derived(
    (kind === "focus" ? timer.current.focusMinutes : timer.current.restMinutes) * 60
  );
  const progress = $derived(duration === 0 ? 0 : 1 - remaining / duration);
  const ring = $derived(Math.max(0, Math.min(1, progress)));
  const label = $derived(format(remaining));
  const completedPomodoros = $derived(timer.current.history.filter((session) => session.kind === "focus").length);

  function format(total: number): string {
    const clamped = Math.max(0, total);
    const minutes = Math.floor(clamped / 60);
    const seconds = clamped % 60;
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  function syncRemaining(): void {
    remaining = (kind === "focus" ? timer.current.focusMinutes : timer.current.restMinutes) * 60;
  }

  function stopTick(): void {
    if (tick) clearInterval(tick);
    tick = null;
    running = false;
  }

  function start(): void {
    if (remaining <= 0) syncRemaining();
    running = true;
    tick = setInterval(() => {
      remaining -= 1;
      if (remaining > 0) return;
      const elapsed = duration;
      const startedAt = new Date().toISOString();
      stopTick();
      timer.current.history.unshift({
        startedAt,
        kind,
        seconds: elapsed,
      });
      timer.current.history = timer.current.history.slice(0, 12);
      kind = kind === "focus" ? "rest" : "focus";
      syncRemaining();
    }, 1000);
  }

  function toggleRun(): void {
    if (running) stopTick();
    else start();
  }

  function reset(): void {
    stopTick();
    syncRemaining();
  }

  function chooseKind(value: string): void {
    if (running || (value !== "focus" && value !== "rest")) return;
    kind = value;
    syncRemaining();
  }

  $effect(() => {
    void timer.current.focusMinutes;
    void timer.current.restMinutes;
    void kind;
    if (!running) syncRemaining();
  });
  $effect(() => { if (!timer.isLoading) ready(); });
  onDestroy(() => { if (tick) clearInterval(tick); timer.destroy(); });
</script>

<main
  class="tomato-timer"
  data-running={running ? "true" : "false"}
  data-kind={kind}
  data-slop-selection="none"
  aria-label="Focus instrument"
>
  <span class="leaf-mark" aria-hidden="true"><i></i><i></i><i></i></span>
  <output class="completed-count" aria-label={`${completedPomodoros} completed pomodoros`}><span aria-hidden="true">🍅</span>{completedPomodoros}</output>

  <section class="timer-stage" aria-label={`${kind} timer: ${label} remaining`} aria-live="polite">
    <div class="dial-wrap">
      <svg class="timer-dial" viewBox="0 0 120 120" aria-hidden="true">
        {#each Array(24) as _, index}
          <line x1="60" y1="3" x2="60" y2={index % 3 === 0 ? 9 : 6} transform={`rotate(${index * 15} 60 60)`} />
        {/each}
        <circle class="dial-track" cx="60" cy="60" r="48" />
        <circle
          class="dial-progress"
          cx="60"
          cy="60"
          r="48"
          transform="rotate(-90 60 60)"
          stroke-dasharray={2 * Math.PI * 48}
          stroke-dashoffset={(1 - ring) * 2 * Math.PI * 48}
        />
      </svg>
      <div class="timer-readout">
        <strong>{label}</strong>
        <small>{kind === "focus" ? "focus session" : "short break"} · {Math.round(ring * 100)}%</small>
      </div>
    </div>

    <Tabs.Root value={kind} onValueChange={chooseKind}>
      <Tabs.List class="mode-switch" aria-label="Timer mode" data-slop-export="hide">
        <Tabs.Trigger value="focus" disabled={running}>Focus <span>{timer.current.focusMinutes}m</span></Tabs.Trigger>
        <Tabs.Trigger value="rest" disabled={running}>Break <span>{timer.current.restMinutes}m</span></Tabs.Trigger>
      </Tabs.List>
    </Tabs.Root>
    <div class="run-control" data-slop-export="hide">
      <button class="run-button" onclick={toggleRun} aria-label={running ? "Pause timer" : "Start timer"}>{#if running}<Pause fill="currentColor" />{:else}<Play fill="currentColor" />{/if}<span>{running ? "Pause" : "Start"}</span></button>
      <button class="reset-button" onclick={reset} aria-label="Reset timer"><RotateCcw /></button>
    </div>
  </section>

  {#if timer.error}
    <p class="timer-error">The timer history could not be saved. {timer.error}</p>
  {/if}
</main>

{#if capture.isRenderer()}<Icon />{/if}
