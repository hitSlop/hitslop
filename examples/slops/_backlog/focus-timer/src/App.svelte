<script lang="ts">
  import { capture, ready } from "@hitslop/runtime";
  import { jsonStore, IconTarget, ExportTarget } from "@hitslop/svelte";
  import { Tabs, Button } from "bits-ui";
  import { onDestroy, onMount, tick, untrack } from "svelte";
  import { Tween, prefersReducedMotion } from "svelte/motion";
  import { cubicOut } from "svelte/easing";
  import Pause from "@lucide/svelte/icons/pause";
  import Play from "@lucide/svelte/icons/play";
  import RotateCcw from "@lucide/svelte/icons/rotate-ccw";
  import timerSchema from "../schema";
  import { createCountdown } from "./countdown.svelte";
  import Dial from "./Dial.svelte";
  import Leaf from "./Leaf.svelte";
  import Icon from "./Icon.svelte";
  import Export from "./Export.svelte";
  import * as s from "./styles.css";

  const timer = jsonStore({ schema: timerSchema, initial: {
    focusMinutes: 25, restMinutes: 5, history: [],
  } });
  const clock = createCountdown(
    () => ({ focusMinutes: timer.current.focusMinutes, restMinutes: timer.current.restMinutes }),
    session => {
      timer.current.history.unshift(session);
      timer.current.history = timer.current.history.slice(0, 12);
    },
  );
  const state = clock.state;
  const running = $derived(state.status === "running");
  const label = $derived(`${String(Math.floor(state.remaining / 60)).padStart(2, "0")}:${String(state.remaining % 60).padStart(2, "0")}`);
  const remainingRatio = $derived(Math.max(0, Math.min(1, state.remaining / state.duration)));
  const arc = new Tween(untrack(() => remainingRatio), { duration: 350, easing: cubicOut });
  let initialized = false;
  const completed = $derived(timer.current.history.filter(session => session.kind === "focus").length);
  const action = $derived(running ? "Pause" : state.status === "paused" ? "Resume" : "Start");
  const status = $derived(state.status === "paused" ? "Paused · take your time"
    : running ? state.kind === "focus" ? "Time to focus" : "Take a little break"
    : state.status === "complete" ? state.completedKind === "focus" ? "Focus done. Break ready." : "Break done. Focus ready."
    : "Ready when you are");

  $effect(() => {
    if (!running) return;
    const interval = setInterval(clock.advance, 250);
    return () => clearInterval(interval);
  });
  $effect(() => { if (timer.isReady) ready(); });
  $effect(() => {
    const instant = !initialized || !timer.isReady || prefersReducedMotion.current;
    void arc.set(remainingRatio, { duration: instant ? 0 : 350, delay: 0 });
    initialized = timer.isReady;
  });
  onMount(() => capture.onPrepare(async () => {
    await arc.set(remainingRatio, { duration: 0, delay: 0 });
    await tick();
  }));
  onDestroy(() => {
    void arc.set(arc.target, { duration: 0, delay: 0 });
    timer.destroy();
  });
</script>

<main class={s.shell} data-kind={state.kind} data-status={state.status} data-slop-selection="none" aria-label="Pomodoro timer" aria-busy={timer.isLoading}>
  <Leaf />
  <section class={s.stage} aria-label="Timer">
    <Dial {label} ratio={arc.current} kind={state.kind}>
      {#snippet modes()}
        <Tabs.Root value={state.kind} onValueChange={clock.select}>
          <Tabs.List class={s.modeSwitch} aria-label="Timer mode" data-slop-export="hide">
            <Tabs.Trigger class={s.modeTrigger} value="focus" disabled={running || timer.isLoading}>Focus <span class={s.modeDuration}>{timer.current.focusMinutes}m</span></Tabs.Trigger>
            <Tabs.Trigger class={s.modeTrigger} value="rest" disabled={running || timer.isLoading}>Break <span class={s.modeDuration}>{timer.current.restMinutes}m</span></Tabs.Trigger>
          </Tabs.List>
        </Tabs.Root>
      {/snippet}
      {#snippet detail()}
        <p class={s.status} role="status">{timer.isLoading ? "Getting ready…" : status}</p>
      {/snippet}
    </Dial>
    <div class={s.controls} data-slop-export="hide">
      <Button.Root class={s.startButton} disabled={timer.isLoading} onclick={() => running ? clock.pause() : clock.start()} aria-label={`${action} timer`}>
        {#if running}<Pause class={s.startIcon} fill="currentColor" aria-hidden="true" />{:else}<Play class={s.startIcon} fill="currentColor" aria-hidden="true" />{/if}
        <span>{action}</span>
      </Button.Root>
      <Button.Root class={s.resetButton} disabled={timer.isLoading} onclick={clock.reset} aria-label="Reset timer" title="Reset timer"><RotateCcw class={s.resetIcon} aria-hidden="true" /></Button.Root>
    </div>
  </section>
  {#if timer.error}
    <p class={s.error} role="alert">Session not saved. <button class={s.retryButton} onclick={() => void timer.flush().catch(() => {})}>Retry</button></p>
  {:else}
    <p class={s.completedCount} aria-label={`${completed} focus sessions in the last ${timer.current.history.length} saved sessions`}><span class={s.countDot} aria-hidden="true"></span>{completed} recent focus {completed === 1 ? "session" : "sessions"}</p>
  {/if}
</main>

<IconTarget><Icon minutes={state.kind === "focus" ? timer.current.focusMinutes : timer.current.restMinutes} /></IconTarget>
<ExportTarget><Export kind={state.kind} {label} ratio={remainingRatio} {completed} /></ExportTarget>
