<script lang="ts">
  import { capture } from "@hitslop/runtime";
  import { jsonStore } from "@hitslop/svelte";
  import SvelteMarkdown from "@humanspeak/svelte-markdown";
  import Bold from "@lucide/svelte/icons/bold";
  import Check from "@lucide/svelte/icons/check";
  import Copy from "@lucide/svelte/icons/copy";
  import Heading1 from "@lucide/svelte/icons/heading-1";
  import Heading2 from "@lucide/svelte/icons/heading-2";
  import Italic from "@lucide/svelte/icons/italic";
  import List from "@lucide/svelte/icons/list";
  import Moon from "@lucide/svelte/icons/moon";
  import Quote from "@lucide/svelte/icons/quote";
  import Sun from "@lucide/svelte/icons/sun";
  import { Tabs } from "bits-ui";
  import Icon from "./Icon.svelte";

  type MarkdownDoc = {
    title: string;
    content: string;
    mode: "inplace" | "split" | "preview";
    theme: "paper" | "dark";
  };

  const doc = jsonStore<MarkdownDoc>({
    title: "Welcome to OverType",
    content: `# Welcome to OverType

The markdown editor that is literally just a **native textarea** layered over rendered markdown.

## Why this exists
1. Native browser undo, redo, and selection
2. Works seamlessly with mobile and desktop keyboards
3. Zero contentEditable bugs, zero virtual DOM complexity

> "Simple request: Edit markdown. Reality: Install 50+ dependencies."
> OverType keeps it delightfully simple.

## Code Example
\`\`\`js
const editor = new OverType('#editor', {
  value: '# Hello World',
  theme: 'paper'
});
\`\`\`

Try editing this document now!`,
    mode: "inplace",
    theme: "paper",
  });

  let textareaEl: HTMLTextAreaElement | undefined = $state();
  let backdropEl: HTMLDivElement | undefined = $state();
  let copied = $state(false);

  const words = $derived(
    doc.current.content.trim() ? doc.current.content.trim().split(/\s+/).length : 0
  );
  const chars = $derived(doc.current.content.length);
  const readingTime = $derived(Math.max(1, Math.ceil(words / 200)));

  function highlightMarkdown(raw: string): string {
    const escaped = raw
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    return escaped
      .split("\n")
      .map((line) => {
        // Headings
        const headingMatch = line.match(/^(#{1,6})(\s+)(.*)$/);
        if (headingMatch) {
          return `<span class="syntax-md-hash">${headingMatch[1]}</span>${headingMatch[2]}<strong class="syntax-md-heading">${headingMatch[3]}</strong>`;
        }
        // Blockquote
        const quoteMatch = line.match(/^(&gt;)(\s*)(.*)$/);
        if (quoteMatch) {
          return `<span class="syntax-md-token">&gt;</span>${quoteMatch[2]}<span class="syntax-md-quote">${quoteMatch[3]}</span>`;
        }
        // Lists
        const listMatch = line.match(/^(\s*[-*+]\s+|\s*\d+\.\s+)(.*)$/);
        if (listMatch) {
          return `<span class="syntax-md-token">${listMatch[1]}</span>${formatInline(listMatch[2])}`;
        }
        return formatInline(line);
      })
      .join("\n");
  }

  function formatInline(text: string): string {
    return text
      .replace(/\*\*([^*]+)\*\*/g, '<span class="syntax-md-token">**</span><strong class="syntax-md-bold">$1</strong><span class="syntax-md-token">**</span>')
      .replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<span class="syntax-md-token">*</span><em class="syntax-md-italic">$1</em><span class="syntax-md-token">*</span>')
      .replace(/`([^`]+)`/g, '<span class="syntax-md-token">`</span><code class="syntax-md-code">$1</code><span class="syntax-md-token">`</span>');
  }

  function onScroll() {
    if (textareaEl && backdropEl) {
      backdropEl.scrollTop = textareaEl.scrollTop;
    }
  }

  function insertFormatting(prefix: string, suffix: string = "") {
    if (!textareaEl) return;
    const start = textareaEl.selectionStart;
    const end = textareaEl.selectionEnd;
    const current = doc.current.content;
    const selected = current.slice(start, end);
    const replacement = `${prefix}${selected || "text"}${suffix}`;
    doc.current.content = current.slice(0, start) + replacement + current.slice(end);

    setTimeout(() => {
      if (textareaEl) {
        textareaEl.focus();
        textareaEl.setSelectionRange(
          start + prefix.length,
          start + prefix.length + (selected.length || 4)
        );
      }
    }, 10);
  }

  async function copyMarkdown() {
    await navigator.clipboard.writeText(doc.current.content);
    copied = true;
    setTimeout(() => (copied = false), 1800);
  }

  function toggleTheme() {
    doc.current.theme = doc.current.theme === "paper" ? "dark" : "paper";
  }
</script>

<main class="editor-canvas" data-theme={doc.current.theme}>
  <article class="editor-sheet">
    <!-- Header -->
    <header class="editor-header">
      <input
        class="title-input"
        aria-label="Document Title"
        bind:value={doc.current.title}
      />

      <div class="header-actions" data-slop-export="hide">
        <!-- View Mode Switcher -->
        <Tabs.Root
          value={doc.current.mode}
          onValueChange={(v) => { if (v) doc.current.mode = v as "inplace" | "split" | "preview"; }}
        >
          <Tabs.List class="mode-pills" aria-label="Editor modes">
            <Tabs.Trigger
              value="inplace"
              class="mode-btn {doc.current.mode === 'inplace' ? 'active' : ''}"
            >
              In-Place
            </Tabs.Trigger>
            <Tabs.Trigger
              value="split"
              class="mode-btn {doc.current.mode === 'split' ? 'active' : ''}"
            >
              Split
            </Tabs.Trigger>
            <Tabs.Trigger
              value="preview"
              class="mode-btn {doc.current.mode === 'preview' ? 'active' : ''}"
            >
              Preview
            </Tabs.Trigger>
          </Tabs.List>
        </Tabs.Root>

        <!-- Theme Toggle -->
        <button
          type="button"
          class="icon-btn"
          aria-label="Toggle theme"
          onclick={toggleTheme}
        >
          {#if doc.current.theme === "paper"}
            <Moon size={14} />
          {:else}
            <Sun size={14} />
          {/if}
        </button>

        <!-- Copy Action -->
        <button
          type="button"
          class="icon-btn"
          aria-label="Copy markdown"
          onclick={copyMarkdown}
        >
          {#if copied}
            <Check size={14} />
          {:else}
            <Copy size={14} />
          {/if}
        </button>
      </div>
    </header>

    <!-- Formatting Toolbar (Hidden in Preview Mode) -->
    {#if doc.current.mode !== "preview"}
      <section class="format-toolbar" data-slop-export="hide" aria-label="Text formatting">
        <button
          type="button"
          class="tool-btn"
          title="Heading 1"
          onclick={() => insertFormatting("# ")}
        >
          <Heading1 size={14} />
        </button>
        <button
          type="button"
          class="tool-btn"
          title="Heading 2"
          onclick={() => insertFormatting("## ")}
        >
          <Heading2 size={14} />
        </button>
        <div class="toolbar-sep"></div>
        <button
          type="button"
          class="tool-btn"
          title="Bold"
          onclick={() => insertFormatting("**", "**")}
        >
          <Bold size={14} />
        </button>
        <button
          type="button"
          class="tool-btn"
          title="Italic"
          onclick={() => insertFormatting("*", "*")}
        >
          <Italic size={14} />
        </button>
        <button
          type="button"
          class="tool-btn"
          title="Code"
          onclick={() => insertFormatting("`", "`")}
        >
          &lt;/&gt;
        </button>
        <div class="toolbar-sep"></div>
        <button
          type="button"
          class="tool-btn"
          title="List Item"
          onclick={() => insertFormatting("- ")}
        >
          <List size={14} />
        </button>
        <button
          type="button"
          class="tool-btn"
          title="Blockquote"
          onclick={() => insertFormatting("> ")}
        >
          <Quote size={14} />
        </button>
      </section>
    {/if}

    <!-- Central Editor Body -->
    <section class="editor-body">
      {#if doc.current.mode === "inplace"}
        <!-- OverType Mode: Invisible native textarea over highlighted syntax backdrop -->
        <div class="overtype-wrapper">
          <textarea
            bind:this={textareaEl}
            class="overtype-textarea"
            aria-label="Markdown editor"
            spellcheck="false"
            bind:value={doc.current.content}
            onscroll={onScroll}
          ></textarea>
          <div
            bind:this={backdropEl}
            class="overtype-backdrop"
            aria-hidden="true"
          >
            {@html highlightMarkdown(doc.current.content) + "\n"}
          </div>
        </div>
      {:else if doc.current.mode === "split"}
        <!-- Split Mode: Left textarea, Right SvelteMarkdown -->
        <div class="split-wrapper">
          <div class="split-pane">
            <textarea
              class="split-source-textarea"
              aria-label="Markdown source"
              bind:value={doc.current.content}
            ></textarea>
          </div>
          <div class="split-divider"></div>
          <div class="split-pane prose-column">
            <SvelteMarkdown source={doc.current.content} />
          </div>
        </div>
      {:else}
        <!-- Preview / Reading Mode: Centered editorial prose -->
        <div class="preview-wrapper">
          <article class="prose-column">
            <SvelteMarkdown source={doc.current.content} />
          </article>
        </div>
      {/if}
    </section>

    <!-- Footer Stats -->
    <footer class="editor-footer">
      <span class="stats-pill">{words} words · {chars} chars</span>
      <span class="stats-pill">{readingTime} min read</span>
    </footer>
  </article>
</main>

{#if capture.isRenderer()}
  <Icon />
{/if}
