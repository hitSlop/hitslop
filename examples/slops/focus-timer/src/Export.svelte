<script lang="ts">
  import * as s from "./styles.css";
  import Dial from "./Dial.svelte";
  import Leaf from "./Leaf.svelte";
  let { kind, label, ratio, completed }: { kind: "focus" | "rest"; label: string; ratio: number; completed: number } = $props();
</script>

<article class={s.exportShell} data-kind={kind} aria-label="Pomodoro snapshot">
  <Leaf />
  <section class={s.stage}>
    <Dial {label} {ratio} {kind}>
      {#snippet detail()}<p class={s.status}>Time remaining</p>{/snippet}
    </Dial>
  </section>
  <p class={s.exportName}>Pomodoro</p>
  <p class={s.completedCount}>{completed} recent focus {completed === 1 ? "session" : "sessions"}</p>
</article>
