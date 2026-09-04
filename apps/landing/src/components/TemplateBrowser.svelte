<script lang="ts">
  import { onMount } from "svelte";
  import { SITE_LINKS } from "../constants";

  type Category = "all" | "productivity" | "utilities" | "finance" | "media" | "education" | "business" | "personal";
  type Preview = "planner" | "pixel" | "recipe" | "subscriptions" | "image";
  type Template = {
    slug: string;
    title: string;
    description: string;
    family: "Paper" | "Instrument" | "Skin";
    categories: Exclude<Category, "all">[];
    preview: Preview;
    image?: string;
    tone: string;
  };

  const categories: { id: Category; label: string }[] = [
    { id: "all", label: "All" },
    { id: "productivity", label: "Productivity" },
    { id: "utilities", label: "Utilities" },
    { id: "finance", label: "Finance" },
    { id: "media", label: "Media" },
    { id: "education", label: "Education" },
    { id: "business", label: "Business" },
    { id: "personal", label: "Personal" },
  ];

  const templates: Template[] = [
    { slug: "daily-planner", title: "Daily Planner", description: "A folded appointment book for priorities, time blocks, and the shape of one day.", family: "Paper", categories: ["productivity", "personal"], preview: "planner", tone: "mint" },
    { slug: "alien-radio", title: "Alien Radio", description: "A sculpted desktop receiver for exploring listener-supported SomaFM stations.", family: "Skin", categories: ["media", "personal"], preview: "image", image: "/assets/templates/alien-radio.png", tone: "night" },
    { slug: "invoice", title: "Invoice", description: "Line items, tax, status, and a finished document you can export or send.", family: "Paper", categories: ["business", "finance"], preview: "image", image: "/assets/templates/invoice.png", tone: "paper" },
    { slug: "focus-timer", title: "Pomodoro", description: "A playful tomato timer for focus sprints, breaks, and local session history.", family: "Instrument", categories: ["productivity", "personal"], preview: "image", image: "/assets/templates/focus-timer.png", tone: "peach" },
    { slug: "pixel-art", title: "Pixel Art Studio", description: "A pocket-console sprite desk for 16×16 drawing, palettes, undo, and PNG export.", family: "Instrument", categories: ["media", "utilities"], preview: "pixel", tone: "violet" },
    { slug: "recipe", title: "Recipe", description: "A tactile recipe card with editable steps and a guided cooking mode.", family: "Paper", categories: ["personal"], preview: "recipe", tone: "butter" },
    { slug: "random-picker", title: "Random Picker", description: "A playful capsule for choosing one option and remembering recent picks.", family: "Instrument", categories: ["utilities", "personal"], preview: "image", image: "/assets/templates/random-picker.png", tone: "blue" },
    { slug: "subscription-tracker", title: "Subscription Tracker", description: "A calm local ledger for recurring costs, renewal dates, and monthly pace.", family: "Paper", categories: ["finance", "personal"], preview: "subscriptions", tone: "sage" },
    { slug: "flashcards", title: "Flashcards", description: "A tactile index-card study machine with deck editing and spaced repetition.", family: "Instrument", categories: ["education", "productivity"], preview: "planner", tone: "lilac" },
  ];

  let query = $state("");
  let category = $state<Category>("all");
  let input: HTMLInputElement;

  const filtered = $derived(templates.filter((template) => {
    const categoryMatches = category === "all" || template.categories.includes(category);
    const needle = query.trim().toLowerCase();
    const searchMatches = !needle || [template.title, template.description, template.family, ...template.categories].join(" ").toLowerCase().includes(needle);
    return categoryMatches && searchMatches;
  }));

  const heading = $derived(query.trim() ? `Results for “${query.trim()}”` : category === "all" ? "Featured slops" : categories.find((item) => item.id === category)?.label ?? "Slops");

  function reset(): void {
    query = "";
    category = "all";
    input?.focus();
  }

  onMount(() => {
    const focusSearch = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        input?.focus();
      }
    };
    window.addEventListener("keydown", focusSearch);
    return () => window.removeEventListener("keydown", focusSearch);
  });
</script>

<div class="browser">
  <div class="search-row">
    <label class="search-field">
      <span class="sr-only">Search templates</span>
      <svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="10.5" cy="10.5" r="6.5"></circle><path d="m16 16 4.2 4.2"></path></svg>
      <input bind:this={input} bind:value={query} placeholder="Search timers, invoices, radios, tools…" />
      {#if query}
        <button type="button" onclick={() => query = ""} aria-label="Clear search">×</button>
      {:else}
        <kbd>⌘ K</kbd>
      {/if}
    </label>
  </div>

  <div class="category-list" aria-label="Template categories">
    {#each categories as item}
      <button type="button" class:active={category === item.id} aria-pressed={category === item.id} onclick={() => category = item.id}>{item.label}</button>
    {/each}
  </div>

  <div class="result-heading" aria-live="polite">
    <h3>{heading}</h3>
    <span>{filtered.length} {filtered.length === 1 ? "result" : "results"}</span>
  </div>

  {#if filtered.length}
    <div class="template-grid">
      {#each filtered as template, index}
        <article class="template-card" class:lead={index === 0 && filtered.length > 3}>
          <a class="preview-stage" data-tone={template.tone} href={`${SITE_LINKS.repository}/tree/main/examples/slops/${template.slug}`} target="_blank" rel="noreferrer" aria-label={`View ${template.title} example source`}>
            {#if template.preview === "image"}
              <img src={template.image} alt={`Preview of ${template.title}`} loading="lazy" />
            {:else if template.preview === "planner"}
              <div class="planner-object" aria-hidden="true"><i></i><i></i><i></i><header><small>Tuesday · Sep 2</small><strong>{template.title === "Flashcards" ? "Design systems" : "Today"}</strong></header><p><b></b><span>{template.title === "Flashcards" ? "What makes an affordance?" : "Finish the first useful thing"}</span></p><p><b></b><span>{template.title === "Flashcards" ? "Reveal the answer" : "Walk before lunch"}</span></p><p><b></b><span>{template.title === "Flashcards" ? "Next card →" : "Call Maya at 2:30"}</span></p></div>
            {:else if template.preview === "pixel"}
              <div class="pixel-object" aria-hidden="true"><header><span>PIXEL</span><b>16×16</b></header><div class="pixel-screen">{#each Array(64) as _, pixel}<i class:on={[2,3,10,11,17,20,25,28,33,36,42,43,50,51,58,59].includes(pixel)}></i>{/each}</div><footer><span></span><b>＋</b><b>○</b></footer></div>
            {:else if template.preview === "recipe"}
              <div class="recipe-object" aria-hidden="true"><header><small>30 min · Easy</small><strong>Creamy miso noodles</strong></header><div class="recipe-photo"><span>🍜</span></div><ol><li>Simmer the broth</li><li>Add noodles and greens</li><li>Finish with sesame</li></ol></div>
            {:else}
              <div class="subscription-object" aria-hidden="true"><header><span>Monthly</span><strong>$47.97</strong></header><p><b>F</b><span>Figma<small>Renews Sep 12</small></span><em>$15</em></p><p><b>M</b><span>Music<small>Renews Sep 18</small></span><em>$11</em></p><p><b>C</b><span>Cloud<small>Renews Sep 24</small></span><em>$21</em></p></div>
            {/if}
          </a>
          <div class="template-copy">
            <div class="title-row"><div><small>{template.family}</small><h4>{template.title}</h4></div><span aria-hidden="true">↗</span></div>
            <p>{template.description}</p>
            <div class="template-footer"><span>{template.categories.join(" · ")}</span><a href={`${SITE_LINKS.repository}/tree/main/examples/slops/${template.slug}`} target="_blank" rel="noreferrer">View example</a></div>
          </div>
        </article>
      {/each}
    </div>
  {:else}
    <div class="empty-state">
      <span aria-hidden="true">⌕</span>
      <div><h3>No matching slops yet.</h3><p>Try another word or return to the complete shelf.</p><button type="button" onclick={reset}>Show every slop</button></div>
    </div>
  {/if}

  <div class="catalog-note"><span>Built from real examples</span><p>Every result above links to a maintained source project in the repository.</p></div>
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
  .result-heading h3 { margin: 0; font-size: 1rem; }
  .result-heading span { color: var(--faint); font-size: .7rem; }
  .template-grid { margin-top: 34px; display: grid; gap: 42px 22px; }
  .template-card { min-width: 0; display: grid; align-content: start; }
  .preview-stage { position: relative; min-height: 350px; padding: 24px; display: grid; place-items: center; overflow: hidden; border: 1px solid color-mix(in oklch, var(--ink), transparent 87%); border-radius: 22px; }
  .preview-stage[data-tone="mint"] { background: oklch(92% .05 145); }
  .preview-stage[data-tone="night"] { background: oklch(24% .055 294); }
  .preview-stage[data-tone="paper"] { background: oklch(95% .028 84); }
  .preview-stage[data-tone="peach"] { background: oklch(94% .05 40); }
  .preview-stage[data-tone="violet"] { background: oklch(90% .05 300); }
  .preview-stage[data-tone="butter"] { background: oklch(95% .065 91); }
  .preview-stage[data-tone="blue"] { background: oklch(92% .045 268); }
  .preview-stage[data-tone="sage"] { background: oklch(91% .035 160); }
  .preview-stage[data-tone="lilac"] { background: oklch(92% .045 310); }
  .preview-stage img { width: auto; height: auto; max-width: 94%; max-height: 315px; object-fit: contain; filter: drop-shadow(0 18px 24px oklch(18% .03 65 / .18)); transition: transform 280ms cubic-bezier(.22,1,.36,1); }
  .template-copy { padding: 16px 2px 0; }
  .title-row { display: flex; align-items: start; justify-content: space-between; gap: 15px; }
  .title-row > div { display: grid; gap: 2px; }
  .title-row small { color: var(--faint); font-size: .58rem; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; }
  .title-row h4 { margin: 0; font-size: 1.1rem; letter-spacing: -.025em; }
  .title-row > span { color: var(--faint); transition: transform 200ms cubic-bezier(.22,1,.36,1); }
  .template-copy > p { min-height: 3.2em; margin: 8px 0 0; color: var(--muted); font-size: .76rem; line-height: 1.58; }
  .template-footer { margin-top: 15px; padding-top: 12px; display: flex; align-items: center; justify-content: space-between; gap: 14px; border-top: 1px solid var(--rule); }
  .template-footer > span { color: var(--faint); font-size: .59rem; text-transform: capitalize; }
  .template-footer a { font-size: .66rem; font-weight: 700; }
  .empty-state { min-height: 310px; display: flex; align-items: center; gap: 19px; border-bottom: 1px solid var(--rule); }
  .empty-state > span { color: oklch(70% .18 35); font-size: 2rem; }
  .empty-state h3 { margin: 0; font-size: 1rem; }
  .empty-state p { margin: 5px 0 15px; color: var(--muted); font-size: .8rem; }
  .empty-state button { min-height: 40px; padding: 0 13px; border: 1px solid var(--rule); border-radius: 7px; background: oklch(99.8% .002 250); font-size: .7rem; font-weight: 700; cursor: pointer; }
  .catalog-note { margin-top: 60px; padding: 19px 0; display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 7px 20px; border-block: 1px solid var(--rule); }
  .catalog-note span { font-family: "Newsreader", Georgia, serif; font-size: 1.1rem; font-weight: 650; }
  .catalog-note p { margin: 0; color: var(--faint); font-size: .68rem; }
  .planner-object { position: relative; width: min(92%, 320px); min-height: 280px; padding: 30px 27px; border: 1px solid oklch(73% .035 80); border-radius: 7px; color: oklch(27% .03 70); background: repeating-linear-gradient(to bottom, oklch(98% .02 80) 0 38px, oklch(82% .025 80) 39px); box-shadow: 9px 10px 0 oklch(34% .05 80 / .14), 0 20px 40px oklch(22% .04 70 / .13); transform: rotate(-1.5deg); }
  .planner-object > i { position: absolute; top: 12px; width: 8px; height: 8px; border-radius: 50%; background: oklch(62% .04 75); box-shadow: inset 0 2px 2px oklch(20% .02 75 / .35); }
  .planner-object > i:first-child { left: 28%; }.planner-object > i:nth-child(2) { left: 50%; }.planner-object > i:nth-child(3) { left: 72%; }
  .planner-object header { margin-bottom: 29px; display: grid; }
  .planner-object header small { font-size: .58rem; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }
  .planner-object header strong { font-family: "Newsreader", Georgia, serif; font-size: 2rem; line-height: 1; }
  .planner-object p { height: 39px; margin: 0; display: flex; align-items: center; gap: 9px; font-size: .67rem; }
  .planner-object p b { width: 12px; height: 12px; border: 1px solid oklch(45% .04 80); border-radius: 2px; }
  .pixel-object { width: min(92%, 290px); padding: 17px; border: 5px solid oklch(19% .03 290); border-radius: 35px; color: oklch(96% .02 300); background: oklch(49% .16 300); box-shadow: inset 0 0 0 4px oklch(61% .14 300), 0 20px 34px oklch(25% .08 300 / .25); transform: rotate(1deg); }
  .pixel-object header { display: flex; justify-content: space-between; font-size: .62rem; font-weight: 800; }
  .pixel-screen { width: min(100%, 190px); aspect-ratio: 1; margin: 14px auto; padding: 9px; display: grid; grid-template-columns: repeat(8,1fr); gap: 2px; border: 4px solid oklch(19% .03 290); border-radius: 11px; background: oklch(20% .03 270); }
  .pixel-screen i { border-radius: 1px; background: oklch(30% .04 270); }.pixel-screen i.on { background: oklch(82% .16 96); }
  .pixel-object footer { display: flex; justify-content: flex-end; gap: 8px; }.pixel-object footer b { width: 28px; height: 28px; display: grid; place-items: center; border: 2px solid oklch(19% .03 290); border-radius: 50%; color: oklch(19% .03 290); background: oklch(87% .13 92); font-size: .7rem; }
  .recipe-object { position: relative; width: min(94%, 340px); min-height: 285px; padding: 25px; border: 1px solid oklch(75% .04 80); border-radius: 5px; color: oklch(28% .035 64); background: oklch(98% .025 83); box-shadow: 8px 10px 0 oklch(43% .05 72 / .13); transform: rotate(1.2deg); }
  .recipe-object header { width: 58%; display: grid; }.recipe-object header small { color: oklch(50% .04 70); font-size: .56rem; }.recipe-object header strong { font-family: "Newsreader", Georgia, serif; font-size: 1.5rem; line-height: 1; }
  .recipe-photo { position: absolute; top: 18px; right: 18px; width: 98px; height: 98px; display: grid; place-items: center; border-radius: 50%; background: oklch(91% .08 75); box-shadow: inset 0 0 0 8px oklch(46% .04 60); }.recipe-photo span { font-size: 3.4rem; }
  .recipe-object ol { margin: 52px 0 0; padding-left: 18px; display: grid; gap: 14px; font-size: .66rem; }
  .subscription-object { width: min(94%, 340px); min-height: 280px; padding: 24px; border: 1px solid oklch(72% .035 155); border-radius: 15px; color: oklch(27% .045 155); background: oklch(97% .025 155); box-shadow: 8px 9px 0 oklch(38% .06 155 / .14); }
  .subscription-object header { margin-bottom: 18px; display: flex; align-items: end; justify-content: space-between; }.subscription-object header span { font-family: "Newsreader", Georgia, serif; font-size: 1.25rem; }.subscription-object header strong { font-size: 1.5rem; }
  .subscription-object p { min-height: 58px; margin: 0; display: grid; grid-template-columns: 30px 1fr auto; align-items: center; gap: 9px; border-top: 1px solid oklch(83% .035 155); }.subscription-object p > b { width: 26px; height: 26px; display: grid; place-items: center; border-radius: 7px; color: oklch(97% .02 155); background: oklch(42% .09 155); font-size: .62rem; }.subscription-object p > span { display: grid; font-size: .67rem; font-weight: 700; }.subscription-object p small { color: oklch(49% .04 155); font-size: .54rem; font-weight: 500; }.subscription-object em { font-size: .65rem; font-style: normal; }
  button:focus-visible, a:focus-visible, input:focus-visible { outline: 3px solid oklch(57% .2 260); outline-offset: 3px; }
  @media (min-width: 680px) { .template-grid { grid-template-columns: repeat(2,minmax(0,1fr)); }.template-card.lead { grid-column: 1 / -1; grid-template-columns: 1.18fr .82fr; align-items: stretch; border: 1px solid var(--rule); border-radius: 24px; overflow: hidden; background: oklch(99.8% .002 250); }.template-card.lead .preview-stage { min-height: 460px; border: 0; border-radius: 0; }.template-card.lead .template-copy { padding: 36px; display: grid; align-content: end; }.template-card.lead .template-copy > p { min-height: 0; font-size: .86rem; }.template-card.lead .title-row h4 { font-size: 1.65rem; } }
  @media (min-width: 1040px) { .template-grid { grid-template-columns: repeat(3,minmax(0,1fr)); }.template-card.lead { grid-column: span 2; }.template-card:nth-child(2) .preview-stage { min-height: 460px; } }
  @media (hover:hover) and (pointer:fine) { .preview-stage:hover img, .preview-stage:hover > div { transform: translateY(-4px) rotate(0); }.template-card:hover .title-row > span { transform: translate(2px,-2px); }.category-list button:hover { color: var(--ink); } }
  @media (prefers-reduced-motion:reduce) { .preview-stage img, .preview-stage > div, .title-row > span { transition: none; } }
</style>
