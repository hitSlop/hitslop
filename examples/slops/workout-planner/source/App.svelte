<script lang="ts">
  import { capture } from "@hitslop/runtime";
  import { jsonStore } from "@hitslop/svelte";
  import Plus from "@lucide/svelte/icons/plus";
  import Trash2 from "@lucide/svelte/icons/trash-2";
  import { Toggle, Progress } from "bits-ui";
  import Icon from "./Icon.svelte";
  import { onDestroy } from "svelte";

  type Exercise = {
    id: string;
    name: string;
    target: string;
    totalSets: number;
    completedSets: number;
    weight: string;
  };

  type WorkoutData = {
    title: string;
    exercises: Exercise[];
  };

  const doc = jsonStore<WorkoutData>({
    title: "LEG DAY - Today",
    exercises: [
      { id: "1", name: "Barbell Back Squat", target: "4 × 8", totalSets: 4, completedSets: 4, weight: "225 lbs" },
      { id: "2", name: "Romanian Deadlift", target: "4 × 10", totalSets: 4, completedSets: 2, weight: "185 lbs" },
      { id: "3", name: "Leg Press", target: "3 × 12", totalSets: 3, completedSets: 1, weight: "360 lbs" },
      { id: "4", name: "Lying Leg Curl", target: "3 × 12", totalSets: 3, completedSets: 0, weight: "90 lbs" },
      { id: "5", name: "Standing Calf Raise", target: "4 × 15", totalSets: 4, completedSets: 0, weight: "140 lbs" },
    ],
  });

  let newName = $state("");
  let newSets = $state(4);
  let newReps = $state(10);
  let newWeight = $state("");

  // Rest Timer
  let restSeconds = $state(0);
  let timerInterval: ReturnType<typeof setInterval> | null = null;

  onDestroy(() => {
    if (timerInterval) clearInterval(timerInterval);
  });

  function startRest(seconds: number) {
    if (timerInterval) clearInterval(timerInterval);
    restSeconds = seconds;
    timerInterval = setInterval(() => {
      if (restSeconds > 0) {
        restSeconds -= 1;
      } else {
        if (timerInterval) clearInterval(timerInterval);
        timerInterval = null;
      }
    }, 1000);
  }

  function resetRest() {
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = null;
    restSeconds = 0;
  }

  const totalPossibleSets = $derived(
    doc.current.exercises.reduce((sum, ex) => sum + (ex.totalSets || 0), 0)
  );
  const totalCompletedSets = $derived(
    doc.current.exercises.reduce((sum, ex) => sum + (ex.completedSets || 0), 0)
  );
  const percentComplete = $derived(
    totalPossibleSets > 0 ? Math.round((totalCompletedSets / totalPossibleSets) * 100) : 0
  );

  function addExercise() {
    const name = newName.trim();
    if (!name) return;
    doc.current.exercises.push({
      id: crypto.randomUUID(),
      name,
      target: `${newSets} × ${newReps}`,
      totalSets: Number(newSets) || 3,
      completedSets: 0,
      weight: newWeight.trim() ? newWeight.trim() : "Bodyweight",
    });
    newName = "";
    newWeight = "";
  }

  function removeExercise(id: string) {
    doc.current.exercises = doc.current.exercises.filter((ex) => ex.id !== id);
  }

  function toggleSet(exercise: Exercise, setIndex: number) {
    if (exercise.completedSets === setIndex + 1) {
      exercise.completedSets = setIndex;
    } else {
      exercise.completedSets = setIndex + 1;
    }
  }
</script>

<main class="workout-canvas">
  <article class="cartridge-shell">
    <div class="cartridge-top">
      <div class="speaker-slats" aria-hidden="true">
        <span class="speaker-slat"></span>
        <span class="speaker-slat"></span>
        <span class="speaker-slat"></span>
      </div>
      <span class="cartridge-brand">HITSLOP POCKET CARTRIDGE</span>
    </div>

    <!-- Retro LCD Screen -->
    <section class="lcd-bezel" aria-label="Workout screen">
      <header class="lcd-header">
        <input
          class="workout-title-input"
          aria-label="Workout routine title"
          bind:value={doc.current.title}
        />
        <span class="progress-tag">{totalCompletedSets}/{totalPossibleSets} sets</span>
      </header>

      <!-- Quick Add Row -->
      <form
        class="add-exercise-form"
        data-slop-export="hide"
        onsubmit={(e) => { e.preventDefault(); addExercise(); }}
      >
        <input
          class="add-input add-name-input"
          placeholder="New exercise..."
          aria-label="Exercise name"
          bind:value={newName}
        />
        <input
          class="add-input add-sets-input"
          placeholder="Sets"
          type="number"
          min="1"
          max="10"
          aria-label="Target sets"
          bind:value={newSets}
        />
        <input
          class="add-input add-name-input"
          placeholder="Weight (optional)"
          aria-label="Exercise weight"
          bind:value={newWeight}
        />
        <button type="submit" class="add-btn" aria-label="Add exercise">
          <Plus size={13} />
        </button>
      </form>

      <!-- Exercises List -->
      <ul class="exercises-list">
        {#each doc.current.exercises as ex (ex.id)}
          <li class="exercise-card">
            <div class="exercise-main-row">
              <input
                class="exercise-name-input"
                aria-label="Exercise name"
                bind:value={ex.name}
              />
              <input
                class="exercise-target-input"
                aria-label="{ex.name} target"
                bind:value={ex.target}
              />
              <button
                class="delete-exercise-btn"
                data-slop-export="hide"
                aria-label="Delete {ex.name}"
                onclick={() => removeExercise(ex.id)}
              >
                <Trash2 size={12} />
              </button>
            </div>

            <div class="sets-bubbles-row">
              <div class="bubbles-group" aria-label="Set bubbles">
                {#each Array(ex.totalSets) as _, setIndex}
                  <Toggle.Root
                    pressed={setIndex < ex.completedSets}
                    onPressedChange={() => toggleSet(ex, setIndex)}
                    class="set-bubble"
                    aria-label="Set {setIndex + 1}"
                  >
                    {setIndex + 1}
                  </Toggle.Root>
                {/each}
              </div>
              <input
                class="weight-input"
                aria-label="{ex.name} weight"
                bind:value={ex.weight}
              />
            </div>
          </li>
        {/each}
      </ul>

      <!-- LCD Progress Bar -->
      <Progress.Root
        value={percentComplete}
        max={100}
        class="lcd-progress-track"
        aria-label="Workout completion"
      >
        <div class="lcd-progress-fill" style="width: {percentComplete}%;"></div>
      </Progress.Root>
    </section>

    <!-- Rest Timer Bar -->
    <div class="rest-timer-bar" data-slop-export="hide">
      <span class="rest-label">REST TIMER</span>
      <span class="rest-timer-display">
        {Math.floor(restSeconds / 60)}:{String(restSeconds % 60).padStart(2, "0")}
      </span>
      <div class="rest-btn-group">
        <button type="button" class="rest-btn" onclick={() => startRest(60)}>60s</button>
        <button type="button" class="rest-btn" onclick={() => startRest(90)}>90s</button>
        {#if restSeconds > 0}
          <button type="button" class="rest-btn active" onclick={resetRest}>Stop</button>
        {/if}
      </div>
    </div>

    <!-- Embossed Dumbbell Mark -->
    <div class="dumbbell-emboss" aria-hidden="true">
      <span class="db-plate"></span>
      <span class="db-bar"></span>
      <span class="db-plate"></span>
    </div>
  </article>
</main>

{#if capture.isRenderer()}
  <Icon />
{/if}
