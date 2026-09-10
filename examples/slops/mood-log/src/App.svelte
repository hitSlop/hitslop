<script lang="ts">
  import { ready } from "@hitslop/runtime";
  import { jsonStore, IconTarget, ExportTarget } from "@hitslop/svelte";
  import { onDestroy } from "svelte";
  import { prefersReducedMotion } from "svelte/motion";
  import { flip } from "svelte/animate";
  import { Slider, RadioGroup, Button } from "bits-ui";
  import Trash2 from "@lucide/svelte/icons/trash-2";
  import moodSchema from "../schema";
  import theme from "../theme";
  import Icon from "./Icon.svelte";
  import Export from "./Export.svelte";
  import * as s from "./styles.css";

  const ORBS = [
    { value: 1, color: theme.vars.orb1, label: "Heavy / Reflective" },
    { value: 2, color: theme.vars.orb2, label: "Low / Subdued" },
    { value: 3, color: theme.vars.orb3, label: "Steady / Centered" },
    { value: 4, color: theme.vars.orb4, label: "Warm / Serene" },
    { value: 5, color: theme.vars.orb5, label: "Radiant / Energized" },
  ];

  const doc = jsonStore({ schema: moodSchema, initial: {
    prompt: "How are you, really?",
    entries: [
      { id: "today", day: "TODAY", mood: 4, energy: 4, note: "Clear head after a quiet morning." },
      { id: "yesterday", day: "YESTERDAY", mood: 5, energy: 5, note: "Deep work clicked." },
      { id: "tue", day: "TUE 26", mood: 3, energy: 3, note: "A little stretched, still moving." },
    ],
  } });
  $effect(() => { if (doc.isReady) ready(); });
  onDestroy(() => doc.destroy());
  const flipMs = $derived(prefersReducedMotion.current ? 0 : 220);

  let draftMood = $state(4);
  let draftEnergy = $state(4);
  let draftNote = $state("");

  function logEntry() {
    const text = draftNote.trim();
    if (!text) return;
    const now = new Date();
    doc.current.entries.unshift({
      id: crypto.randomUUID(),
      day: `${now.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase()} ${now.getDate()}`,
      mood: draftMood,
      energy: draftEnergy,
      note: text,
    });
    draftNote = "";
  }
  const orbColor = (value: number) => ORBS.find(orb => orb.value === value)?.color ?? theme.vars.orb3;
</script>

<main class={s.sheet} data-slop-selection="none" aria-label="Mood journal">
  <input class={s.prompt} aria-label="Journal prompt" bind:value={doc.current.prompt} />
  <section class={s.checkin} data-slop-export="hide" aria-label="Today check in">
    <div class={s.orbs}>
      <RadioGroup.Root class={s.orbGroup} value={String(draftMood)} onValueChange={value => { const next = Number(value); if (next >= 1 && next <= 5) draftMood = next; }} aria-label="Select mood">
        {#each ORBS as orb}
          <RadioGroup.Item value={String(orb.value)} class={s.orb} style="background:{orb.color}" aria-label={orb.label}></RadioGroup.Item>
        {/each}
      </RadioGroup.Root>
      <label class={s.energy}>
        <span>Energy</span>
        <Slider.Root type="single" value={draftEnergy} onValueChange={value => draftEnergy = value} min={1} max={5} step={1} class={s.slider} aria-label="Energy level 1 to 5">
          {#snippet children({ thumbs })}
            <span class={s.track}><Slider.Range class={s.range} /></span>
            {#each thumbs as index}<Slider.Thumb {index} class={s.thumb} aria-label="Energy level" />{/each}
          {/snippet}
        </Slider.Root>
      </label>
    </div>
    <form class={s.composer} onsubmit={event => { event.preventDefault(); logEntry(); }}>
      <input placeholder="One line reflection…" aria-label="Reflection note" bind:value={draftNote} />
      <Button.Root class={s.log} type="submit">Log</Button.Root>
    </form>
  </section>
  <ul class={s.list} aria-label="Check-in history">
    {#each doc.current.entries as item (item.id)}
      <li class={s.row} animate:flip={{ duration: flipMs }}>
        <span class={s.entryOrb} style:background={orbColor(item.mood)} aria-hidden="true"></span>
        <div class={s.meta}><span>{item.day}</span><small>⚡ {item.energy}/5</small></div>
        <p class={s.note}>{item.note}</p>
        <button class={s.remove} data-slop-export="hide" aria-label="Delete entry" onclick={() => { doc.current.entries = doc.current.entries.filter(entry => entry.id !== item.id); }}><Trash2 size={12} /></button>
      </li>
    {:else}
      <li class={s.empty}>Nothing written yet. Log one line.</li>
    {/each}
  </ul>
  <footer class={s.foot}><span>{doc.current.entries.length} reflections recorded</span><span>Quiet journal</span></footer>
</main>

<IconTarget><Icon /></IconTarget>
<ExportTarget><Export data={doc.current} /></ExportTarget>
