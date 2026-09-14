<script lang="ts">
  import type { WorkoutPlanner } from "../schema";
  import { checked, sets } from "./workout";
  import * as s from "./styles.css";
  let { data }: { data: WorkoutPlanner } = $props();
  const total = $derived(data.exercises.reduce((n, ex) => n + sets(ex), 0));
  const done = $derived(
    data.exercises.reduce((n, ex) => n + checked(ex).length, 0),
  );
</script>

<article class={s.exportBoard} aria-label="Workout summary">
  <span class={s.eyebrow}>Training / {done} of {total} sets</span>
  <h1 class={s.exerciseName}>{data.title || "Your workout"}</h1>
  <div class={s.progress}>
    <div
      class={s.fill}
      style:width={`${total ? (done / total) * 100 : 0}%`}
    ></div>
  </div>
  {#each data.exercises as ex}<section class={s.exportLift}>
      <h2 class={s.exportTitle}>{ex.name}</h2>
      <p class={s.description}>
        {sets(ex)} sets × {ex.reps} reps · {ex.weight || "Bodyweight"}
      </p>
      <div class={s.ticks}>
        {#each Array.from({ length: sets(ex) }, (_, i) => i) as i}<span
            class={s.tick}
            data-state={checked(ex).includes(i) ? "checked" : "unchecked"}
            aria-label="Set {i + 1}: {checked(ex).includes(i)
              ? 'complete'
              : 'unfinished'}">{checked(ex).includes(i) ? "✓" : i + 1}</span
          >{/each}
      </div>
    </section>{:else}<p class={s.description}>No exercises yet.</p>{/each}
</article>
