<script lang="ts">
  import { Checkbox } from "bits-ui";
  import Sun from "@lucide/svelte/icons/sun";
  import Moon from "@lucide/svelte/icons/moon";
  import Check from "@lucide/svelte/icons/check";
  import type { FiveMinuteJournal } from "../schema";
  import WritingField from "./WritingField.svelte";
  import * as s from "./styles.css";

  let { data, period, staticView = false }: { data: FiveMinuteJournal; period: "am" | "pm"; staticView?: boolean } = $props();
  const lines = [0, 1, 2] as const;
  const id = $props.id();
  const morning = $derived(period === "am");
  const done = $derived(morning ? data.morningDone : data.eveningDone);
</script>

<section class={s.page} data-period={period} aria-labelledby="{id}-heading">
  <header class={s.pageHeading}>
    <div>
      <h2 id="{id}-heading" class={s.heading}>{morning ? "Morning" : "Evening"}</h2>
      <p class={s.intro}>{morning ? "A little intention for the day ahead." : "A moment to gather the good."}</p>
    </div>
    <span class={s.periodMark} aria-hidden="true">
      {#if morning}<Sun size={42} strokeWidth={1.25} />{:else}<Moon size={42} strokeWidth={1.25} />{/if}
    </span>
  </header>

  {#if morning}
    <div class={s.prompt} role="group" aria-labelledby="{id}-gratitudes">
      <h3 class={s.promptLabel} id="{id}-gratitudes">I am grateful for…</h3>
      {#each lines as i}
        <WritingField bind:value={data.gratitudes[i]} label="Gratitude {i + 1}" prefix={String(i + 1)} placeholder={["A small comfort…", "Someone who makes a difference…", "Something you might otherwise miss…"][i]} {staticView} />
      {/each}
    </div>
    <div class={s.prompt} role="group" aria-labelledby="{id}-intentions">
      <h3 class={s.promptLabel} id="{id}-intentions">What would make today great?</h3>
      {#each lines as i}
        <WritingField bind:value={data.intentions[i]} label="Intention {i + 1}" prefix={String(i + 1)} placeholder={["One thing worth your attention…", "A little time for yourself…", "Something to look forward to…"][i]} {staticView} />
      {/each}
    </div>
    <div class={s.prompt}>
      <h3 class={s.promptLabel}>Daily affirmation</h3>
      <WritingField bind:value={data.affirmation} label="Daily affirmation" prefix="I am" placeholder="Give yourself a few kind words…" {staticView} />
    </div>
  {:else}
    <div class={s.prompt} role="group" aria-labelledby="{id}-highlights">
      <h3 class={s.promptLabel} id="{id}-highlights">Three amazing things today…</h3>
      {#each lines as i}
        <WritingField bind:value={data.highlights[i]} label="Highlight {i + 1}" prefix={String(i + 1)} placeholder={["A moment worth keeping…", "Something that made you smile…", "A small win counts, too…"][i]} {staticView} />
      {/each}
    </div>
    <div class={s.prompt}>
      <h3 class={s.promptLabel}>How could today have been even better?</h3>
      <WritingField bind:value={data.lesson} label="How could today have been even better?" placeholder="A lesson, a boundary, a gentler next time…" {staticView} />
    </div>
  {/if}

  <footer class={s.pageFooter}>
    {#if staticView}
      <span class={s.writtenNote}>{#if done}<Check size={16} />{/if}{done ? "Written" : "Still unfolding"}</span>
    {:else}
      <Checkbox.Root class={s.completion} checked={done} onCheckedChange={checked => { if (morning) data.morningDone = checked === true; else data.eveningDone = checked === true; }} aria-label="{done ? 'Written' : 'Mark as written'}: {morning ? 'Morning' : 'Evening'}">
        {#snippet children({ checked })}
          <span class={s.checkBox}>{#if checked}<Check size={15} strokeWidth={2.5} />{/if}</span>
          {checked ? "Written" : "Mark as written"}
        {/snippet}
      </Checkbox.Root>
    {/if}
    <span class={s.closing}>{morning ? "Carry this into your day." : "Let the rest wait until tomorrow."}</span>
  </footer>
</section>
