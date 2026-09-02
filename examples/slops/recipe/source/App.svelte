<script lang="ts">
  import { capture } from "@hitslop/runtime";
  import { imageStore, jsonStore } from "@hitslop/svelte";
  import { Dialog, Progress } from "bits-ui";
  import ArrowDown from "@lucide/svelte/icons/arrow-down";
  import ArrowUp from "@lucide/svelte/icons/arrow-up";
  import Camera from "@lucide/svelte/icons/camera";
  import Pause from "@lucide/svelte/icons/pause";
  import Play from "@lucide/svelte/icons/play";
  import Plus from "@lucide/svelte/icons/plus";
  import RotateCcw from "@lucide/svelte/icons/rotate-ccw";
  import Trash2 from "@lucide/svelte/icons/trash-2";
  import X from "@lucide/svelte/icons/x";
  import { onDestroy } from "svelte";
  import Icon from "./Icon.svelte";

  type Ingredient = { id: string; text: string; checked: boolean };
  type Step = { id: string; title?: string; text: string; minutes?: number | null };
  type Recipe = {
    title: string;
    description: string;
    difficulty: "Easy" | "Medium" | "Advanced";
    servings: number | null;
    prepMinutes: number | null;
    cookMinutes: number | null;
    ingredients: Ingredient[];
    steps: Step[];
  };

  const recipe = jsonStore<Recipe>({
    title: "Lemon garlic pasta",
    description: "Silky, bright, and ready before the table is set.",
    difficulty: "Easy",
    servings: 2,
    prepMinutes: 10,
    cookMinutes: 20,
    ingredients: [
      { id: "spaghetti", text: "200g spaghetti", checked: false },
      { id: "garlic", text: "4 garlic cloves, thinly sliced", checked: false },
      { id: "olive-oil", text: "2 tbsp extra-virgin olive oil", checked: false },
      { id: "lemon", text: "1 lemon, zest and juice", checked: false },
      { id: "parmesan", text: "½ cup finely grated parmesan", checked: false },
      { id: "seasoning", text: "Salt, pepper, and parsley", checked: false },
    ],
    steps: [
      { id: "boil", title: "Boil the pasta", text: "Cook the pasta in well-salted water until just al dente.", minutes: 10 },
      { id: "sizzle", title: "Sizzle the garlic", text: "Gently sizzle the garlic in olive oil until fragrant.", minutes: 3 },
      { id: "toss", title: "Build the sauce", text: "Add pasta, lemon zest, juice, and a splash of pasta water.", minutes: 2 },
      { id: "finish", title: "Finish and serve", text: "Toss with parmesan until glossy. Season and serve.", minutes: null },
    ],
  });
  const hero = imageStore("hero", { fallback: "/assets/recipe-placeholder.svg" });

  let cookingOpen = $state(false);
  let currentStepIndex = $state(0);
  let completedStepIDs = $state<string[]>([]);
  let remainingByStep = $state<Record<string, number>>({});
  let running = $state(false);
  let finished = $state(false);
  let announcement = $state("");
  let timer: ReturnType<typeof setInterval> | null = null;
  let deadline = 0;
  const activeStep = $derived(recipe.current.steps[currentStepIndex] ?? null);
  const timedStepCount = $derived(recipe.current.steps.filter((step) => stepSeconds(step) > 0).length);
  const activeRemaining = $derived(activeStep ? remainingFor(activeStep) : 0);
  const timerLabel = $derived(formatTime(activeRemaining));

  $effect(() => {
    if (!cookingOpen && running) pauseTimer();
    if (!cookingOpen && finished) resetCookingSession();
  });

  function stepSeconds(step: Step): number { return Math.max(0, Math.round(Number(step.minutes) || 0) * 60); }
  function remainingFor(step: Step): number { return remainingByStep[step.id] ?? stepSeconds(step); }
  function setRemaining(stepID: string, seconds: number): void { remainingByStep = { ...remainingByStep, [stepID]: Math.max(0, seconds) }; }
  function formatTime(seconds: number): string { return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`; }
  function stepTitle(step: Step, index = currentStepIndex): string { return step.title?.trim() || `Step ${index + 1}`; }
  function addIngredient(): void { recipe.current.ingredients.push({ id: crypto.randomUUID(), text: "New ingredient", checked: false }); }
  function removeIngredient(id: string): void { recipe.current.ingredients = recipe.current.ingredients.filter((item) => item.id !== id); }
  function addStep(): void { const number = recipe.current.steps.length + 1; recipe.current.steps.push({ id: crypto.randomUUID(), title: `Step ${number}`, text: "Describe the next step.", minutes: null }); }
  function removeStep(id: string): void {
    recipe.current.steps = recipe.current.steps.filter((item) => item.id !== id);
    delete remainingByStep[id];
    remainingByStep = { ...remainingByStep };
    completedStepIDs = completedStepIDs.filter((stepID) => stepID !== id);
  }
  function move<T>(items: T[], index: number, direction: -1 | 1): void {
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    [items[index], items[target]] = [items[target], items[index]];
  }
  function stopTick(): void { if (timer) clearInterval(timer); timer = null; }
  function pauseTimer(): void {
    if (running && activeStep) setRemaining(activeStep.id, Math.ceil((deadline - Date.now()) / 1000));
    running = false;
    stopTick();
  }
  function toggleTimer(): void {
    if (!activeStep || stepSeconds(activeStep) <= 0) return;
    if (running) { pauseTimer(); return; }
    const stepID = activeStep.id;
    let remaining = remainingFor(activeStep);
    if (remaining <= 0) { remaining = stepSeconds(activeStep); setRemaining(stepID, remaining); }
    deadline = Date.now() + remaining * 1000;
    running = true;
    announcement = `${stepTitle(activeStep)} timer started.`;
    timer = setInterval(() => {
      const next = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setRemaining(stepID, next);
      if (next === 0) { running = false; stopTick(); announcement = `Time’s up for ${stepTitle(activeStep)}.`; }
    }, 250);
  }
  function resetTimer(): void {
    if (!activeStep) return;
    pauseTimer();
    setRemaining(activeStep.id, stepSeconds(activeStep));
    announcement = `${stepTitle(activeStep)} timer reset.`;
  }
  function prepareCooking(): void {
    if (finished) resetCookingSession();
    currentStepIndex = Math.min(currentStepIndex, Math.max(0, recipe.current.steps.length - 1));
    const step = recipe.current.steps[currentStepIndex];
    if (step) announcement = `${stepTitle(step, currentStepIndex)} ready.`;
  }
  function goToStep(index: number): void {
    if (!recipe.current.steps.length) return;
    pauseTimer();
    currentStepIndex = Math.max(0, Math.min(index, recipe.current.steps.length - 1));
    const step = recipe.current.steps[currentStepIndex];
    announcement = `${stepTitle(step, currentStepIndex)}, step ${currentStepIndex + 1} of ${recipe.current.steps.length}.`;
  }
  function nextStep(): void {
    if (!activeStep) return;
    pauseTimer();
    if (!completedStepIDs.includes(activeStep.id)) completedStepIDs = [...completedStepIDs, activeStep.id];
    if (currentStepIndex === recipe.current.steps.length - 1) { finished = true; announcement = `${recipe.current.title} is ready.`; return; }
    goToStep(currentStepIndex + 1);
  }
  function resetCookingSession(): void {
    running = false; stopTick(); currentStepIndex = 0; completedStepIDs = []; remainingByStep = {}; finished = false; announcement = "Cooking session reset.";
  }

  onDestroy(() => { stopTick(); hero.destroy(); recipe.destroy(); });
</script>

<main class="recipe-canvas" data-slop-selection="none">
  <article class="recipe-card" aria-label="Recipe for {recipe.current.title}">
    <header class="hero">
      <div class="intro">
        <div class="utility-line">
          <span>Recipe</span>
          <select class="difficulty" aria-label="Difficulty" bind:value={recipe.current.difficulty}>
            <option>Easy</option><option>Medium</option><option>Advanced</option>
          </select>
        </div>
        <input class="title" aria-label="Recipe title" bind:value={recipe.current.title} />
        <textarea class="description" aria-label="Recipe description" bind:value={recipe.current.description}></textarea>
        <div class="stats">
          <label><span>Serves</span><input aria-label="Servings" type="number" min="1" bind:value={recipe.current.servings} /></label>
          <label><span>Prep</span><span class="number"><input aria-label="Preparation minutes" type="number" min="0" bind:value={recipe.current.prepMinutes} /><small>min</small></span></label>
          <label><span>Cook</span><span class="number"><input aria-label="Cooking minutes" type="number" min="1" bind:value={recipe.current.cookMinutes} /><small>min</small></span></label>
        </div>
      </div>

      <figure class="photo-well">
        <img src={hero.src} alt="{recipe.current.title}" />
        <div class="photo-actions" data-slop-export="hide">
          <button aria-label={hero.hasCustomImage ? "Replace meal photo" : "Add meal photo"} onclick={() => hero.choose()}><Camera />{hero.hasCustomImage ? "Replace" : "Add photo"}</button>
          {#if hero.hasCustomImage}<button class="photo-remove" aria-label="Remove meal photo" onclick={() => hero.remove()}><X /></button>{/if}
        </div>
      </figure>
    </header>

    <Dialog.Root bind:open={cookingOpen}>
      <Dialog.Trigger class="cooking-launch" data-slop-export="hide" disabled={recipe.current.steps.length === 0} onclick={prepareCooking}>
        <span class="launch-mark"><Play /></span>
        <span class="launch-copy"><strong>Cooking mode</strong><small>{recipe.current.steps.length} {recipe.current.steps.length === 1 ? "step" : "steps"} · {timedStepCount} {timedStepCount === 1 ? "timer" : "timers"}</small></span>
        <span class="launch-action">Start cooking <b aria-hidden="true">→</b></span>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay class="cook-overlay" data-slop-export="hide" />
        <Dialog.Content class="cook-dialog" data-slop-export="hide">
          <header class="cook-header">
            <img src={hero.src} alt="" />
            <div><span>NOW COOKING</span><strong>{recipe.current.title}</strong></div>
            <Dialog.Close class="cook-close" aria-label="Close cooking mode" onclick={pauseTimer}><X /></Dialog.Close>
          </header>

          <Progress.Root
            class="cook-progress"
            value={finished ? recipe.current.steps.length : currentStepIndex + 1}
            max={Math.max(1, recipe.current.steps.length)}
            aria-label="Cooking progress"
            aria-valuetext={finished ? "Cooking complete" : `Step ${currentStepIndex + 1} of ${recipe.current.steps.length}`}
          >
            {#each recipe.current.steps as step, index (step.id)}
              <span data-state={finished || completedStepIDs.includes(step.id) ? "complete" : index === currentStepIndex ? "current" : "upcoming"}></span>
            {/each}
          </Progress.Root>

          {#if finished}
            <section class="cook-finished">
              <span class="finished-mark" aria-hidden="true">✓</span>
              <p>ALL STEPS COMPLETE</p>
              <Dialog.Title>{recipe.current.title} is ready.</Dialog.Title>
              <Dialog.Description>Bring it to the table while it’s at its best.</Dialog.Description>
              <div class="finish-actions">
                <button type="button" class="cook-again" onclick={resetCookingSession}><RotateCcw />Cook again</button>
                <Dialog.Close class="finish-done" onclick={resetCookingSession}>Done</Dialog.Close>
              </div>
            </section>
          {:else if activeStep}
            <section class="cook-stage">
              <p class="step-kicker">STEP {String(currentStepIndex + 1).padStart(2, "0")} / {String(recipe.current.steps.length).padStart(2, "0")}</p>
              <Dialog.Title>{stepTitle(activeStep)}</Dialog.Title>
              <Dialog.Description>{activeStep.text}</Dialog.Description>

              {#if stepSeconds(activeStep) > 0}
                <div class="step-timer" data-expired={activeRemaining === 0}>
                  <span>{activeRemaining === 0 ? "TIME’S UP" : running ? "COUNTING DOWN" : "STEP TIMER"}</span>
                  <output aria-live="off">{timerLabel}</output>
                  <div>
                    <button class="timer-reset" type="button" aria-label="Reset step timer" onclick={resetTimer}><RotateCcw /></button>
                    <button class="timer-main" type="button" aria-label={running ? "Pause step timer" : activeRemaining === 0 ? "Restart step timer" : "Start step timer"} onclick={toggleTimer}>
                      {#if running}<Pause />Pause{:else}<Play />{activeRemaining === 0 ? "Again" : "Start"}{/if}
                    </button>
                  </div>
                </div>
              {:else}
                <div class="untimed-step"><span aria-hidden="true">◎</span><p><strong>No timer needed</strong>Move on when this step feels right.</p></div>
              {/if}
            </section>

            <nav class="cook-nav" aria-label="Cooking steps">
              <button type="button" disabled={currentStepIndex === 0} onclick={() => goToStep(currentStepIndex - 1)}><b aria-hidden="true">←</b> Previous</button>
              <span>{currentStepIndex + 1} of {recipe.current.steps.length}</span>
              <button type="button" class="cook-next" onclick={nextStep}>{currentStepIndex === recipe.current.steps.length - 1 ? "Finish" : "Next"} <b aria-hidden="true">→</b></button>
            </nav>
          {/if}
          <p class="sr-only" role="status" aria-live="polite">{announcement}</p>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>

    <div class="recipe-body">
      <section class="ingredients" aria-labelledby="ingredients-heading">
        <div class="section-title"><div><span>01</span><h2 id="ingredients-heading">Ingredients</h2></div><button data-slop-export="hide" aria-label="Add ingredient" onclick={addIngredient}><Plus /></button></div>
        <ul>
          {#each recipe.current.ingredients as item, index (item.id)}
            <li class:checked={item.checked}>
              <input class="check" aria-label="Mark {item.text} complete" type="checkbox" bind:checked={item.checked} />
              <input class="item-copy" aria-label="Ingredient {index + 1}" bind:value={item.text} />
              <div class="row-actions" data-slop-export="hide"><button aria-label="Move ingredient up" disabled={index === 0} onclick={() => move(recipe.current.ingredients, index, -1)}><ArrowUp /></button><button aria-label="Move ingredient down" disabled={index === recipe.current.ingredients.length - 1} onclick={() => move(recipe.current.ingredients, index, 1)}><ArrowDown /></button><button aria-label="Remove ingredient" onclick={() => removeIngredient(item.id)}><Trash2 /></button></div>
            </li>
          {/each}
        </ul>
      </section>

      <section class="method" aria-labelledby="method-heading">
        <div class="section-title"><div><span>02</span><h2 id="method-heading">Method</h2></div><button data-slop-export="hide" aria-label="Add step" onclick={addStep}><Plus /></button></div>
        <ol>
          {#each recipe.current.steps as step, index (step.id)}
            <li>
              <span class="step-number">{String(index + 1).padStart(2, "0")}</span>
              <div class="step-copy">
                <input class="step-title" aria-label="Step {index + 1} title" value={stepTitle(step, index)} oninput={(event) => step.title = event.currentTarget.value} />
                <textarea aria-label="Step {index + 1} instructions" bind:value={step.text}></textarea>
              </div>
              <label class="step-time" title="Optional timer"><input aria-label="Step {index + 1} timer in minutes" type="number" min="0" placeholder="–" bind:value={step.minutes} /><span>min</span></label>
              <div class="row-actions" data-slop-export="hide"><button aria-label="Move step up" disabled={index === 0} onclick={() => move(recipe.current.steps, index, -1)}><ArrowUp /></button><button aria-label="Move step down" disabled={index === recipe.current.steps.length - 1} onclick={() => move(recipe.current.steps, index, 1)}><ArrowDown /></button><button aria-label="Remove step" onclick={() => removeStep(step.id)}><Trash2 /></button></div>
            </li>
          {/each}
        </ol>
      </section>
    </div>

    {#if hero.error}<p class="friendly-error" data-slop-export="hide">That photo couldn’t be added. Try another image.</p>{/if}
    {#if recipe.error}<p class="friendly-error" data-slop-export="hide">Your latest changes couldn’t be saved.</p>{/if}
  </article>
</main>

{#if capture.isRenderer()}
  <Icon />
{/if}
