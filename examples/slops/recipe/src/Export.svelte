<script lang="ts">
  import type { Recipe } from "../schema";
  import * as s from "./styles.css";

  let { data, heroSrc }: { data: Recipe; heroSrc: string } = $props();

  function stepTitle(step: Recipe["steps"][number], index: number): string {
    return step.title.trim() || `Step ${index + 1}`;
  }
</script>

<article class={s.card} aria-label="Exported recipe for {data.title}">
  <header class={s.hero} style:grid-template-columns={heroSrc ? undefined : "1fr"}>
    <div class={s.intro}>
      <div class={s.utilityLine}>

        <span class={s.difficultyTrigger}>{data.difficulty}</span>
      </div>
      <h1 class={s.titleText}>{data.title.trim() || "Untitled recipe"}</h1>
      {#if data.description.trim()}<p class={s.descriptionText}>{data.description}</p>{/if}
      <div class={s.stats}>
        <div><span>Serves</span><strong>{data.servings ?? "—"}</strong></div>
        <div><span>Prep</span><span class={s.number}><strong>{data.prepMinutes ?? "—"}</strong><small>min</small></span></div>
        <div><span>Cook</span><span class={s.number}><strong>{data.cookMinutes ?? "—"}</strong><small>min</small></span></div>
      </div>
    </div>
    {#if heroSrc}<figure class={s.photoWell} data-photo="true">
      {#if heroSrc}<img src={heroSrc} alt="" />{/if}
    </figure>{/if}
  </header>

  <div class={s.body}>
    <section class={s.section} aria-labelledby="export-ingredients">
      <div class={s.sectionTitle}><div><h2 id="export-ingredients">Ingredients</h2></div></div>
      <ul class={s.list}>
        {#each data.ingredients as item (item.id)}
          <li class={s.ingredientRow} data-checked={item.checked}>
            <span data-checkbox-root data-state={item.checked ? "checked" : "unchecked"}></span>
            <span class={s.itemText}>{item.text.trim() || "Untitled ingredient"}</span>
          </li>
        {:else}
          <li class={s.empty}>No ingredients yet.</li>
        {/each}
      </ul>
    </section>
    <section class={s.section} aria-labelledby="export-method">
      <div class={s.sectionTitle}><div><h2 id="export-method">Method</h2></div></div>
      <ol class={s.list}>
        {#each data.steps as step, index (step.id)}
          <li class={s.stepRow}>
            <span class={s.stepNumber}>{String(index + 1).padStart(2, "0")}</span>
            <div class={s.stepCopy}>
              <h3 class={s.stepTitleText}>{stepTitle(step, index)}</h3>
              {#if step.text.trim()}<p class={s.stepBodyText}>{step.text}</p>{/if}
            </div>
            {#if step.minutes}<span class={s.stepTime}>{step.minutes} min</span>{/if}
          </li>
        {:else}
          <li class={s.empty}>No steps yet.</li>
        {/each}
      </ol>
    </section>
  </div>
</article>
