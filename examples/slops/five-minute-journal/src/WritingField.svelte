<script lang="ts">
  import { tick } from "svelte";
  import * as s from "./styles.css";
  let { value = $bindable(""), label, placeholder = "", prefix = "", staticView = false }:
    { value?: string; label: string; placeholder?: string; prefix?: string; staticView?: boolean } = $props();

  function grow(node: HTMLTextAreaElement, _value: string) {
    let alive = true;
    const resize = () => {
      if (!alive) return;
      node.style.height = "auto";
      node.style.height = `${node.scrollHeight}px`;
    };
    let width = 0;
    const observer = new ResizeObserver(entries => {
      const nextWidth = entries[0]?.contentRect.width ?? 0;
      if (nextWidth !== width) { width = nextWidth; resize(); }
    });
    observer.observe(node);
    void document.fonts.ready.then(resize);
    resize();
    return {
      update() { void tick().then(resize); },
      destroy() { alive = false; observer.disconnect(); },
    };
  }
</script>

<div class={s.line}>
  {#if prefix}<span class={s.linePrefix} aria-hidden="true">{prefix}</span>{/if}
  {#if staticView}
    <p class={s.lineText}>{value}</p>
  {:else}
    <textarea class={s.writingField} aria-label={label} {placeholder} rows={1} bind:value use:grow={value}></textarea>
  {/if}
</div>
