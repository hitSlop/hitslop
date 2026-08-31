<script lang="ts">
  import { Switch, Tabs } from "bits-ui";
  import { jsonStore } from "@hitslop/svelte";
  import Pause from "@lucide/svelte/icons/pause";
  import Play from "@lucide/svelte/icons/play";

  type Kind = "focus" | "rest";
  type Session = { startedAt: string; kind: Kind; seconds: number };
  type TimerData = {
    focusMinutes: number;
    restMinutes: number;
    history: Session[];
  };

  const timer = jsonStore<TimerData>({
    focusMinutes: 25,
    restMinutes: 5,
    history: [],
  });

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
      timer.update((data) => {
        data.history.unshift({
          startedAt,
          kind,
          seconds: elapsed,
        });
        data.history = data.history.slice(0, 12);
      });
      kind = kind === "focus" ? "rest" : "focus";
      syncRemaining();
    }, 1000);
  }

  function toggleRun(): void {
    if (running) stopTick();
    else start();
  }

  function setKind(next: Kind): void {
    if (kind === next) return;
    stopTick();
    kind = next;
    syncRemaining();
  }

  function setPreset(focusMinutes: number, restMinutes: number): void {
    stopTick();
    timer.update((data) => { data.focusMinutes = focusMinutes; data.restMinutes = restMinutes; });
  }

  $effect(() => {
    void timer.current.focusMinutes;
    void timer.current.restMinutes;
    void kind;
    if (!running) syncRemaining();
  });
</script>

<main
  class="timer-shell"
  data-running={running ? "true" : "false"}
  data-slop-selection="none"
  aria-label="Focus instrument"
>
  <header class="timer-header">
    <div>
      <p>Longtail studio</p>
      <h1>Focus instrument</h1>
    </div>
    <span class="timer-state"><i aria-hidden="true"></i>{running ? "Running" : "Ready"}</span>
  </header>

  <Tabs.Root value={kind} onValueChange={(value) => {
    if (value === "focus" || value === "rest") setKind(value);
  }} class="mode-switch">
    <Tabs.List aria-label="Timer mode">
      <Tabs.Trigger value="focus">01 / Focus</Tabs.Trigger>
      <Tabs.Trigger value="rest">02 / Rest</Tabs.Trigger>
    </Tabs.List>
  </Tabs.Root>

  <section class="timer-stage" aria-label={`${kind} timer: ${label} remaining`}>
    <div class="dial-wrap">
      <svg class="timer-dial" viewBox="0 0 120 120" aria-hidden="true">
        {#each Array(12) as _, index}
          <line x1="60" y1="3" x2="60" y2={index % 3 === 0 ? 9 : 6} transform={`rotate(${index * 30} 60 60)`} />
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
        <span>{kind === "focus" ? "Deep work" : "Recovery"}</span>
        <strong>{label}</strong>
        <small>{Math.round(ring * 100)}% elapsed</small>
      </div>
    </div>

    <div class="run-control">
      <span>{running ? "Live interval" : "Ready when you are"}</span>
      <Switch.Root checked={running} onCheckedChange={() => toggleRun()} class="run-switch" aria-label={running ? "Pause timer" : "Start timer"}>
        <Switch.Thumb class="run-thumb">
          {#if running}<Pause fill="currentColor" />{:else}<Play fill="currentColor" />{/if}
        </Switch.Thumb>
      </Switch.Root>
    </div>
  </section>

  <footer class="timer-footer">
    <div class="timer-presets" aria-label="Timer presets">
      <span>Programs</span>
      <button onclick={() => setPreset(25, 5)}>25 / 05</button>
      <button onclick={() => setPreset(50, 10)}>50 / 10</button>
    </div>
    <div class="duration-settings">
      <label><span>Focus</span>
      <input
        type="number"
        min="1"
        max="90"
        value={timer.current.focusMinutes}
        onchange={(event) => {
          const focusMinutes = Number(event.currentTarget.value) || 25;
          timer.update((data) => { data.focusMinutes = focusMinutes; });
        }}
      />
      </label>
      <label><span>Rest</span>
      <input
        type="number"
        min="1"
        max="30"
        value={timer.current.restMinutes}
        onchange={(event) => {
          const restMinutes = Number(event.currentTarget.value) || 5;
          timer.update((data) => { data.restMinutes = restMinutes; });
        }}
      />
      </label>
    </div>

    <div class="session-history">
      <p>Recent</p>
      {#if timer.current.history.length > 0}
        <ol>
          {#each timer.current.history.slice(0, 2) as session (session.startedAt)}
            <li><span>{session.kind}</span><strong>{Math.round(session.seconds / 60)}m</strong></li>
          {/each}
        </ol>
      {:else}
        <span>No sessions yet</span>
      {/if}
    </div>
  </footer>

  {#if timer.error}
    <p class="timer-error">The timer history could not be saved. {timer.error}</p>
  {/if}
</main>
