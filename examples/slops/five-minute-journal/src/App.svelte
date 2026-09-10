<script lang="ts">
  import { ready } from "@hitslop/runtime";
  import { jsonStore, IconTarget, ExportTarget } from "@hitslop/svelte";
  import { onDestroy } from "svelte";
  import { Tabs, Collapsible } from "bits-ui";
  import Sun from "@lucide/svelte/icons/sun";
  import Moon from "@lucide/svelte/icons/moon";
  import Check from "@lucide/svelte/icons/check";
  import Plus from "@lucide/svelte/icons/plus";
  import journalSchema from "../schema";
  import { freshJournal, initialView, type View } from "./journal";
  import DatePicker from "./DatePicker.svelte";
  import JournalPage from "./JournalPage.svelte";
  import WritingField from "./WritingField.svelte";
  import Icon from "./Icon.svelte";
  import Export from "./Export.svelte";
  import * as s from "./styles.css";

  const doc = jsonStore({ schema: journalSchema, initial: freshJournal() });
  let view = $state<View>("am");
  let opened = $state(false);
  let thoughtOpen = $state(false);
  $effect(() => {
    if (doc.isReady && !opened) {
      view = initialView(doc.current);
      thoughtOpen = Boolean(doc.current.quote.trim() || doc.current.quoteAuthor.trim());
      opened = true;
      ready();
    }
  });
  onDestroy(() => doc.destroy());
</script>

<main class={s.book} data-slop-selection="none" aria-busy={doc.isLoading} aria-label="Five minute journal">
  <header class={s.masthead}>
    <h1 class={s.title}>Five Minute Journal</h1>
    <DatePicker bind:value={doc.current.date} />
  </header>
  {#if doc.isReady}
    <Tabs.Root value={view} onValueChange={value => { if (value === "am" || value === "pm" || value === "all") view = value; }} class={s.journal}>
      <Tabs.List class={s.tabs} aria-label="Journal view">
        <Tabs.Trigger value="am" class={s.tab} data-period="am"><Sun size={17} />Morning{#if doc.current.morningDone}<Check size={14} aria-label="Written" />{/if}</Tabs.Trigger>
        <Tabs.Trigger value="pm" class={s.tab} data-period="pm"><Moon size={17} />Evening{#if doc.current.eveningDone}<Check size={14} aria-label="Written" />{/if}</Tabs.Trigger>
        <Tabs.Trigger value="all" class={s.dayTab}>Day</Tabs.Trigger>
      </Tabs.List>
      <Tabs.Content value="am" class={s.panel}><JournalPage data={doc.current} period="am" /></Tabs.Content>
      <Tabs.Content value="pm" class={s.panel}><JournalPage data={doc.current} period="pm" /></Tabs.Content>
      <Tabs.Content value="all" class={s.panel}>
        <JournalPage data={doc.current} period="am" />
        <JournalPage data={doc.current} period="pm" />
      </Tabs.Content>
    </Tabs.Root>
    <Collapsible.Root bind:open={thoughtOpen} class={s.thought}>
      <Collapsible.Trigger class={s.thoughtTrigger}>
        {#if !thoughtOpen}<Plus size={15} />{/if}
        {thoughtOpen ? "A thought for this day" : (doc.current.quote || doc.current.quoteAuthor ? "Show this day’s thought" : "Add a thought")}
        {#if thoughtOpen}<span class={s.hideLabel}>Hide</span>{/if}
      </Collapsible.Trigger>
      <Collapsible.Content>
        <WritingField bind:value={doc.current.quote} label="Inspiring thought" placeholder="A thought to carry with you…" />
        <input class={s.authorField} aria-label="Quote author" bind:value={doc.current.quoteAuthor} placeholder="Author, if there is one" />
      </Collapsible.Content>
    </Collapsible.Root>
  {/if}
  {#if doc.error}
    <div class={s.error} role="alert">
      <span>{doc.isReady ? "Changes haven’t been saved." : "This page couldn’t be loaded."} {doc.error}</span>
      <button class={s.retry} onclick={() => { if (doc.isReady) void doc.flush().catch(() => undefined); else void doc.reload(); }}>Try again</button>
    </div>
  {:else if doc.isLoading}
    <p class={s.error} role="status">Opening today’s page…</p>
  {/if}
</main>
<IconTarget><Icon morningDone={doc.current.morningDone} eveningDone={doc.current.eveningDone} /></IconTarget>
<ExportTarget><Export data={doc.current} /></ExportTarget>
