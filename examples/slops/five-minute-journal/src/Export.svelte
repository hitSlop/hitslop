<script lang="ts">
  import type { FiveMinuteJournal } from "../schema";
  import { displayDate } from "./journal";
  import JournalPage from "./JournalPage.svelte";
  import * as s from "./styles.css";
  let { data }: { data: FiveMinuteJournal } = $props();
</script>
<article class={s.exportBook} aria-label="Exported five minute journal">
  <header class={s.masthead}>
    <h1 class={s.title}>Five Minute Journal</h1>
    <p class={s.exportDate}>{displayDate(data.date)}</p>
  </header>
  <JournalPage {data} period="am" staticView />
  <JournalPage {data} period="pm" staticView />
  {#if data.quote.trim() || data.quoteAuthor.trim()}
    <blockquote class={s.exportThought}>
      {#if data.quote.trim()}<p class={s.quoteText}>{data.quote}</p>{/if}
      {#if data.quoteAuthor.trim()}<footer class={s.authorText}>— {data.quoteAuthor}</footer>{/if}
    </blockquote>
  {/if}
</article>
