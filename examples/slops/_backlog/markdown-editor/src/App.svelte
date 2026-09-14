<script lang="ts">
  import { ready } from "@hitslop/runtime";
  import { jsonStore, IconTarget, ExportTarget } from "@hitslop/svelte";
  import { onDestroy, tick } from "svelte";
  import { Button, Tabs } from "bits-ui";
  import SvelteMarkdown from "@humanspeak/svelte-markdown";
  import Bold from "@lucide/svelte/icons/bold";
  import Check from "@lucide/svelte/icons/check";
  import Code from "@lucide/svelte/icons/code";
  import Copy from "@lucide/svelte/icons/copy";
  import Heading1 from "@lucide/svelte/icons/heading-1";
  import Heading2 from "@lucide/svelte/icons/heading-2";
  import Italic from "@lucide/svelte/icons/italic";
  import List from "@lucide/svelte/icons/list";
  import Moon from "@lucide/svelte/icons/moon";
  import Quote from "@lucide/svelte/icons/quote";
  import Sun from "@lucide/svelte/icons/sun";
  import markdownSchema from "../schema";
  import type { MarkdownDoc } from "../schema";
  import Icon from "./Icon.svelte";
  import Export from "./Export.svelte";
  import * as s from "./styles.css";

  type Mode = MarkdownDoc["mode"];
  const MODES: Mode[] = ["inplace", "split", "preview"];
  const SAMPLE = `# On writing in place

The page is just a **native textarea** sitting over the ink.

Type. The marks stay. Undo works. The caret is real.

## Why a typewriter
1. Native undo, redo, and selection
2. The keyboard you already know
3. No contentEditable surprises

> Simple request: edit markdown. Reality: install fifty dependencies.

## Shortcuts
- ⌘B or Ctrl+B for **bold**
- ⌘I or Ctrl+I for *italic*
- ⌘E or Ctrl+E to cycle Edit, Split, and Preview

\`const page = "just a textarea"\`
`;

  const doc = jsonStore({ schema: markdownSchema, initial: {
    title: "On writing in place",
    content: SAMPLE,
    mode: "inplace",
    theme: "paper",
  } });
  $effect(() => { if (doc.isReady) ready(); });
  onDestroy(() => doc.destroy());

  let textareaEl: HTMLTextAreaElement | undefined = $state();
  let backdropEl: HTMLDivElement | undefined = $state();
  let copied = $state(false);

  const words = $derived(countWords(doc.current.content));
  const chars = $derived(doc.current.content.length);
  const readingTime = $derived(Math.max(1, Math.ceil(words / 200)));
  const highlighted = $derived(highlightMarkdown(doc.current.content));

  function countWords(text: string): number {
    const trimmed = text.trim();
    return trimmed === "" ? 0 : trimmed.split(/\s+/).length;
  }
  function isMode(value: string): value is Mode {
    return value === "inplace" || value === "split" || value === "preview";
  }
  function setMode(value: string) {
    if (isMode(value)) doc.current.mode = value;
  }
  function cycleMode() {
    const index = MODES.indexOf(doc.current.mode);
    doc.current.mode = MODES[(index + 1) % MODES.length];
    void tick().then(() => textareaEl?.focus());
  }
  function toggleTheme() {
    doc.current.theme = doc.current.theme === "paper" ? "dark" : "paper";
  }
  function onScroll() {
    if (textareaEl && backdropEl) backdropEl.scrollTop = textareaEl.scrollTop;
  }
  async function restoreSelection(start: number, end: number) {
    await tick();
    textareaEl?.focus();
    textareaEl?.setSelectionRange(start, end);
  }
  function wrap(marker: string) {
    if (!textareaEl || doc.current.mode === "preview") return;
    const start = textareaEl.selectionStart;
    const end = textareaEl.selectionEnd;
    const value = doc.current.content;
    const selected = value.slice(start, end);
    if (selected.startsWith(marker) && selected.endsWith(marker) && selected.length >= marker.length * 2) {
      const inner = selected.slice(marker.length, selected.length - marker.length);
      doc.current.content = value.slice(0, start) + inner + value.slice(end);
      void restoreSelection(start, start + inner.length);
      return;
    }
    if (value.slice(Math.max(0, start - marker.length), start) === marker && value.slice(end, end + marker.length) === marker) {
      doc.current.content = value.slice(0, start - marker.length) + selected + value.slice(end + marker.length);
      void restoreSelection(start - marker.length, end - marker.length);
      return;
    }
    const inner = selected || "text";
    doc.current.content = value.slice(0, start) + marker + inner + marker + value.slice(end);
    void restoreSelection(start + marker.length, start + marker.length + inner.length);
  }
  function prefixLine(prefix: string) {
    if (!textareaEl || doc.current.mode === "preview") return;
    const start = textareaEl.selectionStart;
    const value = doc.current.content;
    const lineStart = value.lastIndexOf("\n", start - 1) + 1;
    const lineEndIdx = value.indexOf("\n", start);
    const lineEnd = lineEndIdx === -1 ? value.length : lineEndIdx;
    const line = value.slice(lineStart, lineEnd);
    const structural = /^(#{1,6} |> |[-*+] |\d+\. )/;
    let nextLine: string;
    if (line.startsWith(prefix)) nextLine = line.slice(prefix.length);
    else if (structural.test(line)) nextLine = line.replace(structural, prefix);
    else nextLine = prefix + line;
    doc.current.content = value.slice(0, lineStart) + nextLine + value.slice(lineEnd);
    const cursor = lineStart + nextLine.length;
    void restoreSelection(cursor, cursor);
  }
  async function copyMarkdown() {
    try {
      await navigator.clipboard.writeText(doc.current.content);
      copied = true;
      window.setTimeout(() => { copied = false; }, 1800);
    } catch {
      copied = false;
    }
  }
  function onKeydown(event: KeyboardEvent) {
    const mod = event.metaKey || event.ctrlKey;
    if (!mod || event.altKey) return;
    const key = event.key.toLowerCase();
    if (key === "e") {
      event.preventDefault();
      cycleMode();
      return;
    }
    if (event.target !== textareaEl || doc.current.mode === "preview") return;
    if (key === "b") { event.preventDefault(); wrap("**"); }
    else if (key === "i") { event.preventDefault(); wrap("*"); }
    else if (key === "1" && event.shiftKey) { event.preventDefault(); prefixLine("# "); }
    else if (key === "2" && event.shiftKey) { event.preventDefault(); prefixLine("## "); }
  }
  function highlightMarkdown(raw: string): string {
    const escaped = raw.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    return escaped.split("\n").map((line) => {
      const heading = line.match(/^(#{1,6})(\s+)(.*)$/);
      if (heading) return `<span class="${s.syntaxHash}">${heading[1]}</span>${heading[2]}<strong class="${s.syntaxHeading}">${heading[3]}</strong>`;
      const quote = line.match(/^(&gt;)(\s*)(.*)$/);
      if (quote) return `<span class="${s.syntaxToken}">&gt;</span>${quote[2]}<span class="${s.syntaxQuote}">${quote[3]}</span>`;
      const list = line.match(/^(\s*(?:[-*+]|\d+\.)\s+)(.*)$/);
      if (list) return `<span class="${s.syntaxToken}">${list[1]}</span>${formatInline(list[2])}`;
      return formatInline(line);
    }).join("\n");
  }
  function formatInline(text: string): string {
    return text
      .replace(/\*\*([^*]+)\*\*/g, `<span class="${s.syntaxToken}">**</span><strong class="${s.syntaxBold}">$1</strong><span class="${s.syntaxToken}">**</span>`)
      .replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, `<span class="${s.syntaxToken}">*</span><em class="${s.syntaxItalic}">$1</em><span class="${s.syntaxToken}">*</span>`)
      .replace(/`([^`]+)`/g, `<span class="${s.syntaxToken}">\`</span><code class="${s.syntaxCode}">$1</code><span class="${s.syntaxToken}">\`</span>`);
  }
</script>

<svelte:window onkeydown={onKeydown} />

<main
  class={s.canvas}
  data-theme={doc.current.theme}
  data-slop-selection="none"
  aria-busy={doc.isLoading}
  aria-label="Markdown manuscript"
>
  <article class={s.sheet} inert={!doc.isReady || doc.isLoading}>
    <header class={s.header}>
      <input class={s.title} aria-label="Document title" placeholder="Untitled" bind:value={doc.current.title} />
      <div class={s.actions} data-slop-export="hide">
        <Tabs.Root value={doc.current.mode} onValueChange={setMode}>
          <Tabs.List class={s.tabs} aria-label="Editor modes">
            <Tabs.Trigger value="inplace" class={s.tab}>Edit</Tabs.Trigger>
            <Tabs.Trigger value="split" class={s.tab}>Split</Tabs.Trigger>
            <Tabs.Trigger value="preview" class={s.tab}>Preview</Tabs.Trigger>
          </Tabs.List>
        </Tabs.Root>
        <Button.Root type="button" class={s.iconBtn} aria-label={doc.current.theme === "paper" ? "Switch to dark carbon" : "Switch to paper"} onclick={toggleTheme}>
          {#if doc.current.theme === "paper"}<Moon size={14} strokeWidth={1.8} />{:else}<Sun size={14} strokeWidth={1.8} />{/if}
        </Button.Root>
        <Button.Root type="button" class={s.iconBtn} data-copied={copied} aria-label="Copy markdown" onclick={copyMarkdown}>
          {#if copied}<Check size={14} strokeWidth={1.8} />{:else}<Copy size={14} strokeWidth={1.8} />{/if}
        </Button.Root>
      </div>
    </header>

    {#if doc.current.mode !== "preview"}
      <section class={s.toolbar} data-slop-export="hide" aria-label="Text formatting">
        <Button.Root type="button" class={s.toolBtn} aria-label="Heading 1" onclick={() => prefixLine("# ")}><Heading1 size={14} strokeWidth={1.8} /></Button.Root>
        <Button.Root type="button" class={s.toolBtn} aria-label="Heading 2" onclick={() => prefixLine("## ")}><Heading2 size={14} strokeWidth={1.8} /></Button.Root>
        <span class={s.toolSep} aria-hidden="true"></span>
        <Button.Root type="button" class={s.toolBtn} aria-label="Bold" onclick={() => wrap("**")}><Bold size={14} strokeWidth={1.8} /></Button.Root>
        <Button.Root type="button" class={s.toolBtn} aria-label="Italic" onclick={() => wrap("*")}><Italic size={14} strokeWidth={1.8} /></Button.Root>
        <Button.Root type="button" class={s.toolBtn} aria-label="Code" onclick={() => wrap("`")}><Code size={14} strokeWidth={1.8} /></Button.Root>
        <span class={s.toolSep} aria-hidden="true"></span>
        <Button.Root type="button" class={s.toolBtn} aria-label="List item" onclick={() => prefixLine("- ")}><List size={14} strokeWidth={1.8} /></Button.Root>
        <Button.Root type="button" class={s.toolBtn} aria-label="Blockquote" onclick={() => prefixLine("> ")}><Quote size={14} strokeWidth={1.8} /></Button.Root>
      </section>
    {/if}

    <section class={s.body}>
      {#if doc.current.mode === "inplace"}
        <div class={s.overtype}>
          <textarea
            bind:this={textareaEl}
            class={s.textarea}
            aria-label="Markdown editor"
            spellcheck="false"
            bind:value={doc.current.content}
            onscroll={onScroll}
          ></textarea>
          <div bind:this={backdropEl} class={s.backdrop} aria-hidden="true">{@html highlighted + "\n"}</div>
          {#if !doc.current.content}<p class={s.placeholder}>Begin the page. Native undo. Real caret.</p>{/if}
        </div>
      {:else if doc.current.mode === "split"}
        <div class={s.split}>
          <div class={s.pane}>
            <textarea bind:this={textareaEl} class={s.source} aria-label="Markdown source" spellcheck="false" bind:value={doc.current.content}></textarea>
          </div>
          <div class={s.divider} aria-hidden="true"></div>
          <div class={`${s.pane} ${s.prose}`}>
            {#if doc.current.content.trim()}
              <SvelteMarkdown source={doc.current.content} />
            {:else}
              <p class={s.empty}>Nothing on the page yet.</p>
            {/if}
          </div>
        </div>
      {:else}
        <div class={s.preview}>
          <article class={s.prose}>
            {#if doc.current.content.trim()}
              <SvelteMarkdown source={doc.current.content} />
            {:else}
              <p class={s.empty}>Nothing on the page yet. Switch to Edit to begin.</p>
            {/if}
          </article>
        </div>
      {/if}
    </section>

    <footer class={s.footer}>
      <span>{words} words · {chars} chars · {readingTime} min read</span>
      <span class={s.hint} data-slop-export="hide">⌘B bold · ⌘I italic · ⌘E views</span>
    </footer>
  </article>

  {#if doc.error}
    <div class={s.error} role="alert">
      <span>{doc.isReady ? "Changes haven’t been saved." : "This manuscript couldn’t be loaded."} {doc.error}</span>
      <Button.Root type="button" data-slop-export="hide" onclick={() => { if (doc.isReady) void doc.flush().catch(() => undefined); else void doc.reload(); }}>Try again</Button.Root>
    </div>
  {:else if doc.isLoading}
    <p class={s.error} role="status">Opening the page…</p>
  {/if}
</main>

<IconTarget><Icon /></IconTarget>
<ExportTarget>
  <Export title={doc.current.title} content={doc.current.content} words={words} readingTime={readingTime} />
</ExportTarget>
