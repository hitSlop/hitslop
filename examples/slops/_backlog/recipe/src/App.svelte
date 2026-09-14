<script lang="ts">
  import { capture, ready } from "@hitslop/runtime";
  import { jsonStore, imageStore, IconTarget, ExportTarget } from "@hitslop/svelte";
  import { onDestroy, onMount, tick, untrack } from "svelte";
  import { Tween, prefersReducedMotion } from "svelte/motion";
  import { cubicOut } from "svelte/easing";
  import { Dialog, Progress, Select, Checkbox } from "bits-ui";
  import { grow } from "./grow";
  import ArrowRight from "@lucide/svelte/icons/arrow-right";
  import ArrowLeft from "@lucide/svelte/icons/arrow-left";
  import Clock from "@lucide/svelte/icons/clock";
  import ArrowDown from "@lucide/svelte/icons/arrow-down";
  import ArrowUp from "@lucide/svelte/icons/arrow-up";
  import Camera from "@lucide/svelte/icons/camera";
  import Check from "@lucide/svelte/icons/check";
  import ChevronDown from "@lucide/svelte/icons/chevron-down";
  import Pause from "@lucide/svelte/icons/pause";
  import Play from "@lucide/svelte/icons/play";
  import Plus from "@lucide/svelte/icons/plus";
  import RotateCcw from "@lucide/svelte/icons/rotate-ccw";
  import Trash2 from "@lucide/svelte/icons/trash-2";
  import X from "@lucide/svelte/icons/x";
  import recipeSchema from "../schema";
  import type { Recipe } from "../schema";
  import Icon from "./Icon.svelte";
  import Export from "./Export.svelte";
  import * as s from "./styles.css";

  const difficulties = [
    { value: "Easy", label: "Easy" },
    { value: "Medium", label: "Medium" },
    { value: "Advanced", label: "Advanced" },
  ] as const;

  const recipe = jsonStore({ schema: recipeSchema, initial: {
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
  } });
  const hero = imageStore("hero", { fallback: "" });

  let cookingOpen = $state(false);
  let currentStepIndex = $state(0);
  let completedStepIDs = $state<string[]>([]);
  let remainingByStep = $state<Record<string, number>>({});
  let running = $state(false);
  let finished = $state(false);
  let announcement = $state("");
  let timer: ReturnType<typeof setInterval> | null = null;
  let deadline = 0;
  let tweenReady = false;

  const activeStep = $derived(recipe.current.steps[currentStepIndex] ?? null);
  const timedStepCount = $derived(recipe.current.steps.filter(step => stepSeconds(step) > 0).length);
  const activeRemaining = $derived(activeStep ? remainingFor(activeStep) : 0);
  const activeDuration = $derived(activeStep ? stepSeconds(activeStep) : 0);
  const remainingRatio = $derived(activeDuration > 0 ? activeRemaining / activeDuration : 0);
  const remainingMotion = new Tween(untrack(() => remainingRatio), { duration: 250, easing: cubicOut });
  const timerLabel = $derived(formatTime(activeRemaining));

  $effect(() => { if (recipe.isReady && !hero.isLoading) ready(); });
  $effect(() => {
    if (!cookingOpen && running) pauseTimer();
    if (!cookingOpen && finished) resetCookingSession();
  });
  $effect(() => {
    const instant = !tweenReady || prefersReducedMotion.current;
    void remainingMotion.set(remainingRatio, { duration: instant ? 0 : 250, delay: 0 });
    tweenReady = true;
  });
  onMount(() => capture.onPrepare(async () => {
    await remainingMotion.set(remainingRatio, { duration: 0, delay: 0 });
    await tick();
  }));
  onDestroy(() => {
    stopTick();
    void remainingMotion.set(remainingMotion.target, { duration: 0, delay: 0 });
    hero.destroy();
    recipe.destroy();
  });

  function isDifficulty(value: string): value is typeof difficulties[number]["value"] {
    return difficulties.some(item => item.value === value);
  }
  function stepSeconds(step: Recipe["steps"][number]): number {
    return Math.max(0, Math.round(Number(step.minutes) || 0) * 60);
  }
  function remainingFor(step: Recipe["steps"][number]): number {
    return remainingByStep[step.id] ?? stepSeconds(step);
  }
  function setRemaining(stepID: string, seconds: number): void {
    remainingByStep = { ...remainingByStep, [stepID]: Math.max(0, seconds) };
  }
  function formatTime(seconds: number): string {
    return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  }
  function stepTitle(step: Recipe["steps"][number], index = currentStepIndex): string {
    return step.title.trim() || `Step ${index + 1}`;
  }
  function addIngredient(): void {
    recipe.current.ingredients.push({ id: crypto.randomUUID(), text: "New ingredient", checked: false });
  }
  function removeIngredient(id: string): void {
    recipe.current.ingredients = recipe.current.ingredients.filter(item => item.id !== id);
  }
  function addStep(): void {
    const number = recipe.current.steps.length + 1;
    recipe.current.steps.push({ id: crypto.randomUUID(), title: `Step ${number}`, text: "Describe the next step.", minutes: null });
  }
  function removeStep(id: string): void {
    recipe.current.steps = recipe.current.steps.filter(item => item.id !== id);
    delete remainingByStep[id];
    remainingByStep = { ...remainingByStep };
    completedStepIDs = completedStepIDs.filter(stepID => stepID !== id);
  }
  function move<T>(items: T[], index: number, direction: -1 | 1): void {
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    [items[index], items[target]] = [items[target], items[index]];
  }
  function stopTick(): void {
    if (timer) clearInterval(timer);
    timer = null;
  }
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
    if (currentStepIndex === recipe.current.steps.length - 1) {
      finished = true;
      announcement = `${recipe.current.title} is ready.`;
      return;
    }
    goToStep(currentStepIndex + 1);
  }
  function resetCookingSession(): void {
    running = false;
    stopTick();
    currentStepIndex = 0;
    completedStepIDs = [];
    remainingByStep = {};
    finished = false;
    announcement = "Cooking session reset.";
  }
</script>

<main class={s.canvas} data-slop-selection="none" aria-busy={recipe.isLoading} aria-label="Recipe card">
  <article class={s.card} aria-label="Recipe for {recipe.current.title}" inert={!recipe.isReady || recipe.isLoading}>
    <header class={s.hero}>
      <div class={s.intro}>
        <div class={s.utilityLine}>

          <Select.Root type="single" value={recipe.current.difficulty} items={[...difficulties]} onValueChange={value => { if (isDifficulty(value)) recipe.current.difficulty = value; }}>
            <Select.Trigger class={s.difficultyTrigger} aria-label="Difficulty">
              <Select.Value placeholder="Difficulty" />
              <ChevronDown size={11} strokeWidth={2.2} data-slop-export="hide" />
            </Select.Trigger>
            <Select.Portal>
              <Select.Content class={s.selectContent} sideOffset={6}>
                <Select.Viewport>
                  {#each difficulties as item (item.value)}
                    <Select.Item value={item.value} label={item.label}>
                      {#snippet children({ selected })}{item.label}{#if selected}<Check size={12} strokeWidth={2.4} />{/if}{/snippet}
                    </Select.Item>
                  {/each}
                </Select.Viewport>
              </Select.Content>
            </Select.Portal>
          </Select.Root>
        </div>
        <textarea rows="1" use:grow={recipe.current.title} class={s.title} aria-label="Recipe title" placeholder="Recipe title" bind:value={recipe.current.title}></textarea>
        <textarea class={s.description} aria-label="Recipe description" placeholder="A short note about the dish" bind:value={recipe.current.description}></textarea>
        <div class={s.stats}>
          <label><span>Serves</span><input aria-label="Servings" type="number" min="1" bind:value={recipe.current.servings} /></label>
          <label><span>Prep</span><span class={s.number}><input aria-label="Preparation minutes" type="number" min="0" bind:value={recipe.current.prepMinutes} /><small>min</small></span></label>
          <label><span>Cook</span><span class={s.number}><input aria-label="Cooking minutes" type="number" min="0" bind:value={recipe.current.cookMinutes} /><small>min</small></span></label>
        </div>
      </div>

      <figure class={s.photoWell} data-photo={hero.hasCustomImage}>
        {#if hero.src}<img src={hero.src} alt={recipe.current.title} />{/if}
        {#if !hero.hasCustomImage}<button class={s.photoInvitation} onclick={() => hero.choose()} data-slop-export="hide"><Camera size={25} strokeWidth={1.5} />Add meal photo</button>{/if}
        {#if hero.hasCustomImage}<div class={s.photoActions} data-slop-export="hide">
          <button type="button" aria-label={hero.hasCustomImage ? "Replace meal photo" : "Add meal photo"} onclick={() => hero.choose()}>
            <Camera size={13} />{hero.hasCustomImage ? "Replace" : "Add photo"}
          </button>
          {#if hero.hasCustomImage}
            <button type="button" class={s.photoRemove} aria-label="Remove meal photo" onclick={() => hero.remove()}><X size={13} /></button>
          {/if}
        </div>{/if}
      </figure>
    </header>

    <Dialog.Root bind:open={cookingOpen}>
      <Dialog.Trigger class={s.cookingLaunch} data-slop-export="hide" disabled={recipe.current.steps.length === 0} onclick={prepareCooking}>
        <span class={s.launchMark}><Play size={14} /></span>
        <span class={s.launchCopy}><strong>Cooking mode</strong><small>{recipe.current.steps.length} {recipe.current.steps.length === 1 ? "step" : "steps"} · {timedStepCount} {timedStepCount === 1 ? "timer" : "timers"}</small></span>
        <span class={s.launchAction}>Start cooking <ArrowRight size={16} aria-hidden="true" /></span>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay class={s.cookOverlay} data-slop-export="hide" />
        <Dialog.Content class={s.cookDialog} data-slop-export="hide">
          <header class={s.cookHeader}>
            {#if hero.src}<img src={hero.src} alt="" />{:else}<span class={s.cookBookMark}><Icon /></span>{/if}
            <div><span>NOW COOKING</span><strong>{recipe.current.title}</strong></div>
            <Dialog.Close class={s.cookClose} aria-label="Close cooking mode" onclick={pauseTimer}><X size={14} /></Dialog.Close>
          </header>

          <Progress.Root
            class={s.cookProgress}
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
            <section class={s.cookFinished}>
              <span class={s.finishedMark} aria-hidden="true"><Check size={30} /></span>
              <p class={s.stepKicker}>ALL STEPS COMPLETE</p>
              <Dialog.Title class={s.cookingTitle}>{recipe.current.title} is ready.</Dialog.Title>
              <Dialog.Description class={s.cookingDescription}>Bring it to the table while it’s at its best.</Dialog.Description>
              <div class={s.finishActions}>
                <button type="button" onclick={resetCookingSession}><RotateCcw size={13} />Cook again</button>
                <Dialog.Close class={s.finishDone} onclick={resetCookingSession}>Done</Dialog.Close>
              </div>
            </section>
          {:else if activeStep}
            <section class={s.cookStage}>
              <p class={s.stepKicker}>STEP {String(currentStepIndex + 1).padStart(2, "0")} / {String(recipe.current.steps.length).padStart(2, "0")}</p>
              <Dialog.Title class={s.cookingTitle}>{stepTitle(activeStep)}</Dialog.Title>
              <Dialog.Description class={s.cookingDescription}>{activeStep.text}</Dialog.Description>

              {#if stepSeconds(activeStep) > 0}
                <div class={s.stepTimer} data-expired={activeRemaining === 0}>
                  <span class={s.timerFill} style:transform={`scaleX(${remainingMotion.current})`}></span>
                  <span class={s.timerCaption}>{activeRemaining === 0 ? "TIME’S UP" : running ? "COUNTING DOWN" : "STEP TIMER"}</span>
                  <output aria-live="off">{timerLabel}</output>
                  <div>
                    <button class={s.timerReset} type="button" aria-label="Reset step timer" onclick={resetTimer}><RotateCcw size={13} /></button>
                    <button class={s.timerMain} type="button" aria-label={running ? "Pause step timer" : activeRemaining === 0 ? "Restart step timer" : "Start step timer"} onclick={toggleTimer}>
                      {#if running}<Pause size={13} />Pause{:else}<Play size={13} />{activeRemaining === 0 ? "Again" : "Start"}{/if}
                    </button>
                  </div>
                </div>
              {:else}
                <div class={s.untimedStep}><span aria-hidden="true"><Clock size={20} /></span><p><strong>No timer needed</strong>Move on when this step feels right.</p></div>
              {/if}
            </section>

            <nav class={s.cookNav} aria-label="Cooking steps">
              <button type="button" disabled={currentStepIndex === 0} onclick={() => goToStep(currentStepIndex - 1)}><ArrowLeft size={16} aria-hidden="true" /> Previous</button>
              <span>{currentStepIndex + 1} of {recipe.current.steps.length}</span>
              <button type="button" class={s.cookNext} onclick={nextStep}>{currentStepIndex === recipe.current.steps.length - 1 ? "Finish" : "Next"} <ArrowRight size={16} aria-hidden="true" /></button>
            </nav>
          {/if}
          <p class={s.srOnly} role="status" aria-live="polite">{announcement}</p>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>

    <div class={s.body}>
      <section class={s.section} aria-labelledby="ingredients-heading">
        <div class={s.sectionTitle}><div><h2 id="ingredients-heading">Ingredients</h2></div><button data-slop-export="hide" aria-label="Add ingredient" onclick={addIngredient}><Plus size={12} /></button></div>
        <ul class={s.list}>
          {#each recipe.current.ingredients as item, index (item.id)}
            <li class={s.ingredientRow} data-checked={item.checked}>
              <Checkbox.Root checked={item.checked} onCheckedChange={checked => item.checked = checked === true} aria-label="Mark {item.text || 'untitled ingredient'} {item.checked ? 'still needed' : 'complete'}">
                {#snippet children({ checked })}{#if checked}<Check size={10} strokeWidth={3} />{/if}{/snippet}
              </Checkbox.Root>
              <input class={s.itemCopy} aria-label="Ingredient {index + 1}" bind:value={item.text} />
              <div class={s.rowActions} data-slop-export="hide">
                <button aria-label="Move ingredient up" disabled={index === 0} onclick={() => move(recipe.current.ingredients, index, -1)}><ArrowUp size={10} /></button>
                <button aria-label="Move ingredient down" disabled={index === recipe.current.ingredients.length - 1} onclick={() => move(recipe.current.ingredients, index, 1)}><ArrowDown size={10} /></button>
                <button aria-label="Remove ingredient" onclick={() => removeIngredient(item.id)}><Trash2 size={10} /></button>
              </div>
            </li>
          {:else}
            <li class={s.empty}>Add what you need to gather.</li>
          {/each}
        </ul>
      </section>

      <section class={s.section} aria-labelledby="method-heading">
        <div class={s.sectionTitle}><div><h2 id="method-heading">Method</h2></div><button data-slop-export="hide" aria-label="Add step" onclick={addStep}><Plus size={12} /></button></div>
        <ol class={s.list}>
          {#each recipe.current.steps as step, index (step.id)}
            <li class={s.stepRow}>
              <span class={s.stepNumber}>{String(index + 1).padStart(2, "0")}</span>
              <div class={s.stepCopy}>
                <input class={s.stepTitle} aria-label="Step {index + 1} title" bind:value={step.title} />
                <textarea use:grow={step.text} aria-label="Step {index + 1} instructions" bind:value={step.text}></textarea>
              </div>
              <label class={s.stepTime} title="Optional timer"><input aria-label="Step {index + 1} timer in minutes" type="number" min="0" placeholder="–" bind:value={step.minutes} /><span>min</span></label>
              <div class={s.rowActions} data-slop-export="hide">
                <button aria-label="Move step up" disabled={index === 0} onclick={() => move(recipe.current.steps, index, -1)}><ArrowUp size={10} /></button>
                <button aria-label="Move step down" disabled={index === recipe.current.steps.length - 1} onclick={() => move(recipe.current.steps, index, 1)}><ArrowDown size={10} /></button>
                <button aria-label="Remove step" onclick={() => removeStep(step.id)}><Trash2 size={10} /></button>
              </div>
            </li>
          {:else}
            <li class={s.empty}>Add the first step, then start cooking.</li>
          {/each}
        </ol>
      </section>
    </div>
  </article>

  {#if recipe.error}
    <p class={s.error} role="alert">
      {recipe.isReady ? "Your latest changes couldn’t be saved." : "This recipe couldn’t be loaded."}
      <button data-slop-export="hide" onclick={() => { if (recipe.isReady) void recipe.flush().catch(() => undefined); else void recipe.reload(); }}>Try again</button>
    </p>
  {:else if hero.error}
    <p class={s.error} role="alert">
      That photo couldn’t be added. Try another image.
      <button data-slop-export="hide" onclick={() => hero.choose()}>Choose photo</button>
    </p>
  {:else if recipe.isLoading}
    <p class={s.error} role="status">Loading your recipe…</p>
  {/if}
</main>

<IconTarget><Icon /></IconTarget>
<ExportTarget><Export data={recipe.current} heroSrc={hero.hasCustomImage ? hero.src ?? "" : ""} /></ExportTarget>
