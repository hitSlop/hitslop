<script lang="ts">
  import { capture, ready } from "@hitslop/runtime";
  import { jsonStore, IconTarget, ExportTarget } from "@hitslop/svelte";
  import { onDestroy, onMount, tick, untrack } from "svelte";
  import { Tween, prefersReducedMotion } from "svelte/motion";
  import { cubicOut } from "svelte/easing";
  import { Slider, Select, Button } from "bits-ui";
  import ChevronDown from "@lucide/svelte/icons/chevron-down";
  import Check from "@lucide/svelte/icons/check";
  import Plus from "@lucide/svelte/icons/plus";
  import Trash2 from "@lucide/svelte/icons/trash-2";
  import decisionSchema from "../schema";
  import type { Factor } from "../schema";
  import { beamTilt, clampWeight, totalWeight } from "./balance";
  import { STATUSES, isStatus } from "./statuses";
  import { grow } from "./grow";
  import Scale from "./Scale.svelte";
  import Icon from "./Icon.svelte";
  import Export from "./Export.svelte";
  import * as s from "./styles.css";

  const doc = jsonStore({ schema: decisionSchema, initial: {
    question: "", date: new Date().toLocaleDateString(), status: "evaluating",
    pros: [], cons: [], verdict: "",
  } });

  $effect(() => { if (doc.isReady) ready(); });

  const proTotal = $derived(totalWeight(doc.current.pros));
  const conTotal = $derived(totalWeight(doc.current.cons));
  const tiltTarget = $derived(beamTilt(proTotal, conTotal));
  const tilt = new Tween(untrack(() => tiltTarget), { duration: 420, easing: cubicOut });
  let initialized = false;

  $effect(() => {
    const instant = !initialized || !doc.isReady || prefersReducedMotion.current;
    void tilt.set(tiltTarget, { duration: instant ? 0 : 420, delay: 0 });
    initialized = doc.isReady;
  });

  onMount(() => capture.onPrepare(async () => {
    await tilt.set(tiltTarget, { duration: 0, delay: 0 });
    await tick();
  }));

  onDestroy(() => {
    void tilt.set(tilt.target, { duration: 0, delay: 0 });
    doc.destroy();
  });

  let draftPro = $state("");
  let draftProWeight = $state(3);
  let draftCon = $state("");
  let draftConWeight = $state(3);
  let proComposer = $state<HTMLInputElement>();
  let conComposer = $state<HTMLInputElement>();

  function addFactor(side: "pros" | "cons") {
    if (doc.isLoading) return;
    const text = (side === "pros" ? draftPro : draftCon).trim();
    if (!text) return;
    const weight = clampWeight(side === "pros" ? draftProWeight : draftConWeight);
    doc.current[side] = [...doc.current[side], { id: crypto.randomUUID(), text, weight }];
    if (side === "pros") {
      draftPro = "";
      draftProWeight = 3;
      proComposer?.focus();
    } else {
      draftCon = "";
      draftConWeight = 3;
      conComposer?.focus();
    }
  }

  function removeFactor(side: "pros" | "cons", id: string) {
    doc.current[side] = doc.current[side].filter(item => item.id !== id);
  }

  function setWeight(item: Factor, value: number) {
    item.weight = clampWeight(value);
  }
</script>

<main class={s.desk} data-slop-selection="none" aria-busy={doc.isLoading} aria-label="Decision balance">
  <article class={s.letter} inert={!doc.isReady || doc.isLoading}>
    <header class={s.letterhead}>
      <div class={s.metaRow}>
        <h1 class={s.stamp}>Decision Balance</h1>
        <label>
          <span class={s.srOnly}>Decision date</span>
          <input class={s.dateField} bind:value={doc.current.date} />
        </label>
      </div>
      <div class={s.questionRow}>
        <label class={s.whether} for="decision-question">Whether to…</label>
        <textarea id="decision-question" class={s.question} aria-label="Decision statement" placeholder="What are you deciding?" rows={1} bind:value={doc.current.question} use:grow={doc.current.question}></textarea>
      </div>
      <Scale tilt={tilt.current} {proTotal} {conTotal} />
    </header>

    <div class={s.spread}>
      <section class={s.column} data-side="for" aria-labelledby="for-heading">
        <div class={s.columnHead}>
          <div>
            <h2 id="for-heading" class={s.columnTitle}>Pros</h2>
            <span class={s.columnHint}>Reasons in favor</span>
          </div>
          <span class={s.columnTotal}>{proTotal} pts</span>
        </div>
        <ul class={s.list}>
          {#each doc.current.pros as item (item.id)}
            <li class={s.row}>
              <textarea class={s.reason} aria-label="Reason for" placeholder="A reason in favor" rows={1} bind:value={item.text} use:grow={item.text}></textarea>
              <div class={s.weight}>
                <span class={s.weightLabel}>Importance <strong>{clampWeight(item.weight)}/5</strong></span>
                <Slider.Root type="single" value={clampWeight(item.weight)} onValueChange={value => setWeight(item, value)} min={1} max={5} step={1} class={s.slider} aria-label="Importance for {item.text || 'this reason'}, 1 minor to 5 decisive">
                  {#snippet children({ thumbs })}
                    <span class={s.track}><Slider.Range class={s.range} /></span>
                    {#each thumbs as index}<Slider.Thumb {index} class={s.thumb} aria-label="Importance for {item.text || 'this reason'}, 1 minor to 5 decisive" />{/each}
                  {/snippet}
                </Slider.Root>
                <Button.Root type="button" class={s.remove} data-slop-export="hide" aria-label="Remove reason for: {item.text || 'untitled'}" onclick={() => removeFactor("pros", item.id)}><Trash2 size={12} strokeWidth={1.8} /></Button.Root>
              </div>
            </li>
          {:else}
            <li class={s.empty}>No motives yet. Add a reason in favor.</li>
          {/each}
        </ul>
        <form class={s.composer} data-slop-export="hide" onsubmit={event => { event.preventDefault(); addFactor("pros"); }}>
          <input bind:this={proComposer} class={s.addInput} aria-label="New reason for" placeholder="Add a reason in favor…" bind:value={draftPro} disabled={doc.isLoading} />
          <div class={s.weight}><span class={s.weightLabel}>Importance <strong>{draftProWeight}/5</strong></span><Slider.Root type="single" value={draftProWeight} onValueChange={value => { draftProWeight = clampWeight(value); }} min={1} max={5} step={1} class={s.slider} aria-label="Importance for new reason in favor">
            {#snippet children({ thumbs })}
              <span class={s.track}><Slider.Range class={s.range} /></span>
              {#each thumbs as index}<Slider.Thumb {index} class={s.thumb} aria-label="Importance for new reason in favor" />{/each}
            {/snippet}
          </Slider.Root></div>
          <Button.Root class={s.add} type="submit" aria-label="Add reason for" disabled={!draftPro.trim() || doc.isLoading}><Plus size={14} strokeWidth={1.8} /></Button.Root>
        </form>
      </section>

      <section class={s.column} data-side="against" aria-labelledby="against-heading">
        <div class={s.columnHead}>
          <div>
            <h2 id="against-heading" class={s.columnTitle}>Cons</h2>
            <span class={s.columnHint}>Reasons against</span>
          </div>
          <span class={s.columnTotal}>{conTotal} pts</span>
        </div>
        <ul class={s.list}>
          {#each doc.current.cons as item (item.id)}
            <li class={s.row}>
              <textarea class={s.reason} aria-label="Reason against" placeholder="A concern" rows={1} bind:value={item.text} use:grow={item.text}></textarea>
              <div class={s.weight}>
                <span class={s.weightLabel}>Importance <strong>{clampWeight(item.weight)}/5</strong></span>
                <Slider.Root type="single" value={clampWeight(item.weight)} onValueChange={value => setWeight(item, value)} min={1} max={5} step={1} class={s.slider} aria-label="Importance against {item.text || 'this reason'}, 1 minor to 5 decisive">
                  {#snippet children({ thumbs })}
                    <span class={s.track}><Slider.Range class={s.range} /></span>
                    {#each thumbs as index}<Slider.Thumb {index} class={s.thumb} aria-label="Importance against {item.text || 'this reason'}, 1 minor to 5 decisive" />{/each}
                  {/snippet}
                </Slider.Root>
                <Button.Root type="button" class={s.remove} data-slop-export="hide" aria-label="Remove reason against: {item.text || 'untitled'}" onclick={() => removeFactor("cons", item.id)}><Trash2 size={12} strokeWidth={1.8} /></Button.Root>
              </div>
            </li>
          {:else}
            <li class={s.empty}>No objections yet. Add a reason against.</li>
          {/each}
        </ul>
        <form class={s.composer} data-slop-export="hide" onsubmit={event => { event.preventDefault(); addFactor("cons"); }}>
          <input bind:this={conComposer} class={s.addInput} aria-label="New reason against" placeholder="Add a reason against…" bind:value={draftCon} disabled={doc.isLoading} />
          <div class={s.weight}><span class={s.weightLabel}>Importance <strong>{draftConWeight}/5</strong></span><Slider.Root type="single" value={draftConWeight} onValueChange={value => { draftConWeight = clampWeight(value); }} min={1} max={5} step={1} class={s.slider} aria-label="Importance for new reason against">
            {#snippet children({ thumbs })}
              <span class={s.track}><Slider.Range class={s.range} /></span>
              {#each thumbs as index}<Slider.Thumb {index} class={s.thumb} aria-label="Importance for new reason against" />{/each}
            {/snippet}
          </Slider.Root></div>
          <Button.Root class={s.add} type="submit" aria-label="Add reason against" disabled={!draftCon.trim() || doc.isLoading}><Plus size={14} strokeWidth={1.8} /></Button.Root>
        </form>
      </section>
    </div>

    <footer class={s.foot}>
      <Select.Root type="single" value={doc.current.status} items={[...STATUSES]} onValueChange={value => { if (isStatus(value)) doc.current.status = value; }}>
        <Select.Trigger class={s.seal} aria-label="Verdict status: {STATUSES.find(item => item.value === doc.current.status)?.label ?? 'Evaluating'}">
          <span class={s.sealFace}><Select.Value placeholder="Evaluating" /></span><ChevronDown size={15} />
        </Select.Trigger>
        <Select.Portal>
          <Select.Content class={s.selectContent} sideOffset={8}>
            <Select.Viewport>
              {#each STATUSES as item (item.value)}
                <Select.Item class={s.selectItem} value={item.value} label={item.label}>
                  {#snippet children({ selected })}{item.label}{#if selected}<Check size={12} strokeWidth={2.2} />{/if}{/snippet}
                </Select.Item>
              {/each}
            </Select.Viewport>
          </Select.Content>
        </Select.Portal>
      </Select.Root>
      <label class={s.verdict}>
        <span class={s.verdictLabel}>Verdict</span>
        <textarea class={s.verdictText} aria-label="Verdict notes" placeholder="Record the conclusion, terms, or next step…" bind:value={doc.current.verdict} use:grow={doc.current.verdict}></textarea>
      </label>
    </footer>
  </article>

  {#if doc.error}
    <div class={s.error} role="alert">
      <span>{doc.isReady ? "Changes haven’t been saved." : "Your sheet couldn’t be loaded."} {doc.error}</span>
      <button data-slop-export="hide" onclick={() => { if (doc.isReady) void doc.flush().catch(() => undefined); else void doc.reload(); }}>Try again</button>
    </div>
  {:else if doc.isLoading}<p class={s.error} role="status">Loading your sheet…</p>{/if}
</main>

<IconTarget><Icon tilt={tiltTarget} /></IconTarget>
<ExportTarget><Export data={doc.current} tilt={tiltTarget} {proTotal} {conTotal} /></ExportTarget>
