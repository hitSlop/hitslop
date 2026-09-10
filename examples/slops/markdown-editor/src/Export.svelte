<script lang="ts">
  import SvelteMarkdown from "@humanspeak/svelte-markdown";
  import * as s from "./styles.css";

  let { title, content, words, readingTime }: {
    title: string;
    content: string;
    words: number;
    readingTime: number;
  } = $props();
</script>

<article class={s.exportSheet} aria-label="Exported manuscript {title}">
  <header>
    <p class={s.exportEyebrow}>Manuscript</p>
    <h1 class={s.exportTitle}>{title.trim() || "Untitled"}</h1>
    <p class={s.exportMeta}>{words} words · {readingTime} min read</p>
  </header>
  <div class={`${s.prose} ${s.exportProse}`}>
    {#if content.trim()}
      <SvelteMarkdown source={content} />
    {:else}
      <p class={s.empty}>This page is blank.</p>
    {/if}
  </div>
</article>
