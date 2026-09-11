<script lang="ts">
  import { onMount } from "svelte";
  import type { CatalogTemplate } from "@hitslop/schema";
  import { SITE_LINKS } from "../constants";
  import * as s from "./TemplateBrowser.css";

  type Category = CatalogTemplate["categories"][number];
  type LoadState = "loading" | "ready" | "error";

  const categoryOptions: { id: Category; label: string }[] = [
    { id: "productivity", label: "Productivity" }, { id: "utilities", label: "Utilities" },
    { id: "finance", label: "Finance" }, { id: "media", label: "Media" },
    { id: "games", label: "Games" }, { id: "developer-tools", label: "Developer tools" },
    { id: "education", label: "Education" }, { id: "business", label: "Business" },
    { id: "personal", label: "Personal" }, { id: "other", label: "Other" },
  ];

  let query = $state("");
  let category = $state<"all" | Category>("all");
  let templates = $state<CatalogTemplate[]>([]);
  let loadState = $state<LoadState>("loading");
  let input: HTMLInputElement;
  let controller: AbortController | undefined;

  const availableCategories = $derived(categoryOptions.filter((option) => templates.some((template) => template.categories.includes(option.id))));
  const filtered = $derived(templates.filter((template) => {
    const categoryMatches = category === "all" || template.categories.includes(category);
    const needle = query.trim().toLowerCase();
    const searchMatches = !needle || [template.title, template.description, template.author.name, ...template.categories].join(" ").toLowerCase().includes(needle);
    return categoryMatches && searchMatches;
  }));
  const heading = $derived(query.trim() ? `Results for “${query.trim()}”` : category === "all" ? "Published slops" : categoryOptions.find((item) => item.id === category)?.label ?? "Slops");

  function isAsset(value: unknown): value is CatalogTemplate["preview"] {
    if (!value || typeof value !== "object" || Array.isArray(value)) return false;
    const asset = value as Record<string, unknown>;
    return typeof asset.url === "string" && /^https?:\/\//.test(asset.url)
      && typeof asset.sha256 === "string" && /^[a-f0-9]{64}$/.test(asset.sha256)
      && typeof asset.bytes === "number" && Number.isSafeInteger(asset.bytes) && asset.bytes > 0;
  }

  function isTemplate(value: unknown): value is CatalogTemplate {
    if (!value || typeof value !== "object" || Array.isArray(value)) return false;
    const item = value as Record<string, unknown>;
    const author = item.author as Record<string, unknown> | undefined;
    const release = item.release as Record<string, unknown> | undefined;
    return typeof item.id === "string" && typeof item.slug === "string" && typeof item.title === "string"
      && typeof item.description === "string" && Array.isArray(item.categories)
      && item.categories.every((entry) => categoryOptions.some((option) => option.id === entry))
      && !!author && typeof author.name === "string" && (author.url === undefined || typeof author.url === "string")
      && typeof item.creationCount === "number" && !!release && typeof release.number === "number"
      && typeof release.publishedAt === "string" && isAsset(item.preview) && isAsset(item.icon) && isAsset(item.download);
  }

  async function loadCatalog(): Promise<void> {
    controller?.abort();
    controller = new AbortController();
    loadState = "loading";
    try {
      const response = await fetch(SITE_LINKS.catalog, { signal: controller.signal, headers: { accept: "application/json" } });
      if (!response.ok) throw new Error(`Catalog returned ${response.status}`);
      const value: unknown = await response.json();
      if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid catalog response");
      const responseValue = value as Record<string, unknown>;
      if (responseValue.version !== 1 || !Array.isArray(responseValue.templates)) throw new Error("Unsupported catalog response");
      templates = responseValue.templates.filter(isTemplate).slice(0, 200);
      loadState = "ready";
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      templates = [];
      loadState = "error";
    }
  }

  function reset(): void { query = ""; category = "all"; input?.focus(); }
  function formatBytes(bytes: number): string {
    if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)} MB`;
  }
  function formatDate(value: string): string {
    const date = new Date(value);
    return Number.isNaN(date.valueOf()) ? "Published" : new Intl.DateTimeFormat("en", { month: "short", year: "numeric" }).format(date);
  }

  onMount(() => {
    void loadCatalog();
    const focusSearch = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k" && loadState === "ready") { event.preventDefault(); input?.focus(); }
    };
    window.addEventListener("keydown", focusSearch);
    return () => { controller?.abort(); window.removeEventListener("keydown", focusSearch); };
  });
</script>

<div class="browser">
  {#if loadState === "loading"}
    <div class="loading-state" role="status"><div><span></span><span></span><span></span></div><p>Loading the public catalog…</p></div>
  {:else if loadState === "error"}
    <div class="load-message" role="alert">
      <span aria-hidden="true">↻</span>
      <div><h3>The catalog couldn’t be loaded.</h3><p>The published slops are still there. Try again, or browse them inside the Mac app.</p><div><button type="button" onclick={loadCatalog}>Try again</button><a href={SITE_LINKS.download}>Download hitSlop</a></div></div>
    </div>
  {:else if templates.length === 0}
    <div class="load-message"><span aria-hidden="true">◇</span><div><h3>Nothing has been published yet.</h3><p>The first public slops will appear here as soon as they land in the catalog.</p></div></div>
  {:else}
    <div class="search-row">
      <label class="search-field">
        <span class="sr-only">Search published slops</span>
        <svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="10.5" cy="10.5" r="6.5"></circle><path d="m16 16 4.2 4.2"></path></svg>
        <input bind:this={input} bind:value={query} placeholder="Search timers, invoices, radios, tools…" />
        {#if query}<button type="button" onclick={() => query = ""} aria-label="Clear search">×</button>{:else}<kbd>⌘ K</kbd>{/if}
      </label>
    </div>
    {#if availableCategories.length > 1}
      <div class="category-list" aria-label="Template categories">
        <button type="button" class:active={category === "all"} aria-pressed={category === "all"} onclick={() => category = "all"}>All</button>
        {#each availableCategories as item}<button type="button" class:active={category === item.id} aria-pressed={category === item.id} onclick={() => category = item.id}>{item.label}</button>{/each}
      </div>
    {/if}
    <div class="result-heading" aria-live="polite"><h3>{heading}</h3><span>{filtered.length} {filtered.length === 1 ? "result" : "results"}</span></div>
    {#if filtered.length}
      <div class={s.grid}>
        {#each filtered as template}
          <article class={s.card}>
            <a class={s.previewStage} href={template.download.url} download={`${template.slug}.slop.zip`} aria-label={`Download ${template.title}`}>
              <img class={s.previewImage} src={template.preview.url} alt={`Preview of ${template.title}`} loading="lazy" />
              <span class={s.previewAction}>Download .slop <b aria-hidden="true">↓</b></span>
            </a>
            <div class={s.copy}>
              <div class={s.titleRow}><img class={s.icon} src={template.icon.url} alt="" loading="lazy" /><div class={s.identity}><small class={s.categories}>{template.categories.join(" · ")}</small><h4 class={s.title}>{template.title}</h4></div></div>
              <p class={s.description}>{template.description}</p>
              <div class={s.byline}>
                <span>By {#if template.author.url}<a class={s.authorLink} href={template.author.url} target="_blank" rel="noreferrer">{template.author.name}</a>{:else}{template.author.name}{/if}</span>
                <span>Release {template.release.number} · {formatDate(template.release.publishedAt)}</span>
              </div>
              <div class={s.footer}><span class={s.fileSize}>{formatBytes(template.download.bytes)}</span><a class={s.download} href={template.download.url} download={`${template.slug}.slop.zip`}>Download template <b class={s.downloadArrow} aria-hidden="true">↓</b></a></div>
            </div>
          </article>
        {/each}
      </div>
    {:else}
      <div class="empty-state"><span aria-hidden="true">⌕</span><div><h3>No matching slops yet.</h3><p>Try another word or return to the complete shelf.</p><button type="button" onclick={reset}>Show every slop</button></div></div>
    {/if}
    <div class="catalog-note"><span><i aria-hidden="true"></i> Live from the public catalog</span></div>
  {/if}
</div>

<style>
  :global(*) { box-sizing: border-box; }
  button, input { font: inherit; }
  .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
  .browser { --ink: oklch(20% .018 255); --muted: oklch(46% .02 255); --faint: oklch(62% .016 255); --rule: oklch(88% .01 255); }
  .search-row { width: min(760px, 100%); }
  .search-field { min-height: 58px; padding: 0 15px; display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 12px; border: 1px solid var(--rule); border-radius: 11px; background: oklch(99.8% .002 250); box-shadow: 0 9px 22px oklch(20% .03 65 / .08); }
  .search-field:focus-within { border-color: oklch(57% .2 260); box-shadow: 0 0 0 3px oklch(57% .2 260 / .12), 0 9px 22px oklch(20% .03 65 / .08); }
  .search-field svg { width: 20px; height: 20px; fill: none; stroke: oklch(70% .18 35); stroke-width: 2; stroke-linecap: round; }
  .search-field input { min-width: 0; width: 100%; border: 0; outline: 0; color: var(--ink); background: transparent; font-size: .92rem; }
  .search-field input::placeholder { color: var(--muted); opacity: 1; }
  .search-field kbd { padding: 5px 7px; border: 1px solid var(--rule); border-bottom-width: 2px; border-radius: 5px; color: var(--muted); background: oklch(97% .005 250); font-size: .62rem; }
  .search-field button { width: 38px; height: 38px; border: 0; border-radius: 50%; color: var(--muted); background: transparent; cursor: pointer; font-size: 1.2rem; }
  .category-list { margin: 14px -18px 0; padding: 0 18px 8px; display: flex; gap: 5px; overflow-x: auto; scrollbar-width: thin; }
  .category-list button { min-height: 42px; padding: 0 12px; flex: none; border: 1px solid transparent; border-radius: 8px; color: var(--muted); background: transparent; font-size: .71rem; font-weight: 650; cursor: pointer; }
  .category-list button.active { border-color: var(--rule); color: var(--ink); background: oklch(99.8% .002 250); box-shadow: 0 4px 12px oklch(20% .03 65 / .06); }
  .result-heading { margin-top: 45px; min-height: 64px; display: flex; align-items: center; justify-content: space-between; gap: 20px; border-block: 1px solid var(--rule); }
  .result-heading h3 { margin: 0; font-size: 1rem; }.result-heading span { color: var(--faint); font-size: .7rem; }
  .loading-state { min-height: 430px; display: grid; place-content: center; gap: 24px; color: var(--muted); text-align: center; }.loading-state > div { display: flex; justify-content: center; gap: 8px; }
  .loading-state span { width: 10px; height: 10px; border-radius: 50%; background: oklch(70% .18 35); animation: loading 900ms ease-in-out infinite alternate; }.loading-state span:nth-child(2) { animation-delay: 150ms; }.loading-state span:nth-child(3) { animation-delay: 300ms; }.loading-state p { margin: 0; font-size: .8rem; }
  .load-message, .empty-state { min-height: 340px; display: flex; align-items: center; gap: 19px; border-block: 1px solid var(--rule); }.load-message > span, .empty-state > span { color: oklch(70% .18 35); font-size: 2rem; }
  .load-message h3, .empty-state h3 { margin: 0; font-size: 1rem; }.load-message p, .empty-state p { max-width: 33rem; margin: 5px 0 15px; color: var(--muted); font-size: .8rem; }.load-message div > div { display: flex; flex-wrap: wrap; gap: 8px; }
  .load-message button, .load-message a, .empty-state button { min-height: 40px; padding: 0 13px; display: inline-flex; align-items: center; border: 1px solid var(--rule); border-radius: 7px; color: var(--ink); background: oklch(99.8% .002 250); font-size: .7rem; font-weight: 700; cursor: pointer; }
  .catalog-note { margin-top: 60px; padding: 19px 0; display: flex; align-items: center; border-block: 1px solid var(--rule); }.catalog-note span { display: inline-flex; align-items: center; gap: 8px; font-family: "Newsreader", Georgia, serif; font-size: 1.1rem; font-weight: 650; }
  .catalog-note i { width: 7px; height: 7px; border-radius: 50%; background: oklch(62% .14 145); box-shadow: 0 0 0 4px oklch(62% .14 145 / .13); }
  button:focus-visible, a:focus-visible, input:focus-visible { outline: 3px solid oklch(57% .2 260); outline-offset: 3px; }
  @keyframes loading { to { transform: translateY(-7px); opacity: .45; } }
  @media (hover: hover) and (pointer: fine) { .category-list button:hover { color: var(--ink); } }
  @media (prefers-reduced-motion: reduce) { .loading-state span { animation: none; } }
</style>
