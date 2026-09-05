<script lang="ts">
  import { capture } from "@hitslop/runtime";
  import { jsonStore } from "@hitslop/svelte";
  import ChevronLeft from "@lucide/svelte/icons/chevron-left";
  import ChevronRight from "@lucide/svelte/icons/chevron-right";
  import Play from "@lucide/svelte/icons/play";
  import Plus from "@lucide/svelte/icons/plus";
  import Trash2 from "@lucide/svelte/icons/trash-2";
  import X from "@lucide/svelte/icons/x";
  import { Dialog } from "bits-ui";
  import Icon from "./Icon.svelte";

  type SlideLayout = "title" | "split" | "metric" | "quote" | "cards";

  type SlideItem = {
    id: string;
    layout: SlideLayout;
    title?: string;
    subtitle?: string;
    tag?: string;
    points?: string[];
    highlightLabel?: string;
    highlightValue?: string;
    highlightDesc?: string;
    metricValue?: string;
    metricLabel?: string;
    quoteText?: string;
    author?: string;
    cards?: Array<{ title: string; desc: string }>;
    notes?: string;
  };

  type DeckData = {
    deckTitle: string;
    theme: "swiss" | "dark" | "navy";
    activeSlideIndex: number;
    slides: SlideItem[];
  };

  const doc = jsonStore<DeckData>({
    deckTitle: "Single-File Desktop Objects",
    theme: "swiss",
    activeSlideIndex: 0,
    slides: [
      {
        id: "1",
        layout: "title",
        title: "Autonomous Desktop Objects",
        subtitle: "The unreasonable effectiveness of single-file local-first software.",
        tag: "LONGTAIL LABS · 2026",
        notes: "Welcome everyone. Introduce the thesis of durable single-file software.",
      },
      {
        id: "2",
        layout: "split",
        title: "Why Single-File Matters",
        points: [
          "Zero cloud rent — you own the file forever",
          "Instant offline execution in any modern browser",
          "Plain view-source honest JSON data",
          "No SaaS logins, subscriptions, or dark patterns",
        ],
        highlightLabel: "DURABILITY",
        highlightValue: "10+ Years",
        highlightDesc: "A file saved in 2026 will open without servers in 2036.",
        notes: "Emphasize data sovereignty and local longevity.",
      },
      {
        id: "3",
        layout: "metric",
        title: "Adoption Velocity",
        metricValue: "12.4x",
        metricLabel: "FASTER TIME-TO-VALUE",
        subtitle: "Teams craft and share bespoke instruments in minutes rather than quarters.",
        tag: "MEASURED OUTCOMES",
        notes: "Highlight rapid iteration cycles compared to bloated enterprise apps.",
      },
      {
        id: "4",
        layout: "quote",
        quoteText: "The interface should feel composed before it feels configurable. Start with a strong opinion, then leave the edges open for the owner.",
        author: "hitSlop Principles",
        notes: "Pause on this quote to reinforce the craft-first ethos.",
      },
      {
        id: "5",
        layout: "cards",
        title: "Three Core Tenets",
        cards: [
          { title: "Tactile Objects", desc: "Apps designed as physical instruments on your desk." },
          { title: "Host Sovereignty", desc: "Data belongs to the user, not a remote server database." },
          { title: "Zero Drag", desc: "Instant boot, offline-first, under 100KB bundles." },
        ],
        notes: "Wrap up key pillars and open the floor to Q&A.",
      },
    ],
  });

  let isPresenting = $state(false);
  let timerSeconds = $state(0);
  let timerInterval: ReturnType<typeof setInterval> | undefined;

  const currentSlide = $derived(
    doc.current.slides[doc.current.activeSlideIndex] ?? doc.current.slides[0]
  );

  function selectSlide(idx: number) {
    doc.current.activeSlideIndex = Math.max(0, Math.min(doc.current.slides.length - 1, idx));
  }

  function addSlide() {
    const newSlide: SlideItem = {
      id: String(Date.now()),
      layout: "split",
      title: "New Slide Title",
      points: [
        "First key insight",
        "Second supporting point",
        "Third impactful takeaway",
      ],
      highlightLabel: "METRIC",
      highlightValue: "100%",
      highlightDesc: "Description of the achievement or focus.",
      notes: "Speaker talking points go here.",
    };
    doc.current.slides.push(newSlide);
    doc.current.activeSlideIndex = doc.current.slides.length - 1;
  }

  function deleteSlide(idx: number) {
    if (doc.current.slides.length <= 1) return;
    doc.current.slides.splice(idx, 1);
    doc.current.activeSlideIndex = Math.min(doc.current.activeSlideIndex, doc.current.slides.length - 1);
  }

  function setLayout(layout: SlideLayout) {
    if (!currentSlide) return;
    currentSlide.layout = layout;
    if (layout === "split" && !currentSlide.points) {
      currentSlide.points = ["Point 1", "Point 2", "Point 3"];
      currentSlide.highlightLabel = "HIGHLIGHT";
      currentSlide.highlightValue = "Key Metric";
    } else if (layout === "metric" && !currentSlide.metricValue) {
      currentSlide.metricValue = "99.9%";
      currentSlide.metricLabel = "RELIABILITY";
    } else if (layout === "quote" && !currentSlide.quoteText) {
      currentSlide.quoteText = "Inspiration leads to innovation.";
      currentSlide.author = "Author Name";
    } else if (layout === "cards" && !currentSlide.cards) {
      currentSlide.cards = [
        { title: "Pillar 1", desc: "First pillar description." },
        { title: "Pillar 2", desc: "Second pillar description." },
        { title: "Pillar 3", desc: "Third pillar description." },
      ];
    }
  }

  function cycleTheme() {
    const themes: Array<"swiss" | "dark" | "navy"> = ["swiss", "dark", "navy"];
    const nextIdx = (themes.indexOf(doc.current.theme) + 1) % themes.length;
    doc.current.theme = themes[nextIdx];
  }

  function startPresenting() {
    isPresenting = true;
    timerSeconds = 0;
    timerInterval = setInterval(() => {
      timerSeconds++;
    }, 1000);
  }

  function stopPresenting() {
    isPresenting = false;
    if (timerInterval) clearInterval(timerInterval);
  }

  function nextSlide() {
    if (doc.current.activeSlideIndex < doc.current.slides.length - 1) {
      doc.current.activeSlideIndex++;
    }
  }

  function prevSlide() {
    if (doc.current.activeSlideIndex > 0) {
      doc.current.activeSlideIndex--;
    }
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (isPresenting) {
      if (e.key === "ArrowRight" || e.key === " " || e.key === "PageDown") {
        e.preventDefault();
        nextSlide();
      } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        prevSlide();
      } else if (e.key === "Escape") {
        e.preventDefault();
        stopPresenting();
      }
    } else {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        startPresenting();
      }
    }
  }

  const formattedTimer = $derived.by(() => {
    const mins = Math.floor(timerSeconds / 60);
    const secs = timerSeconds % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  });
</script>

<svelte:window onkeydown={handleKeyDown} />

<main class="deck-canvas" data-theme={doc.current.theme}>
  <article class="studio-shell">
    <!-- Studio Header -->
    <header class="studio-header">
      <input
        class="deck-title-input"
        aria-label="Deck Title"
        bind:value={doc.current.deckTitle}
      />

      <div class="header-controls" data-slop-export="hide">
        <!-- Layout Switcher -->
        <div class="layout-picker" aria-label="Slide Layout">
          {#each (["title", "split", "metric", "quote", "cards"] as SlideLayout[]) as l}
            <button
              type="button"
              class="layout-btn"
              class:active={currentSlide?.layout === l}
              onclick={() => setLayout(l)}
            >
              {l.toUpperCase()}
            </button>
          {/each}
        </div>

        <!-- Theme Picker -->
        <button
          type="button"
          class="theme-btn"
          title="Change Theme"
          onclick={cycleTheme}
        >
          {doc.current.theme.toUpperCase()}
        </button>

        <!-- Present Button -->
        <button
          type="button"
          class="present-btn"
          title="Start Presentation (Cmd+Enter)"
          onclick={startPresenting}
        >
          <Play size={13} fill="#ffffff" />
          <span>PRESENT</span>
        </button>
      </div>
    </header>

    <!-- Main Workspace -->
    <section class="studio-workspace">
      <!-- Left Filmstrip Sidebar -->
      <aside class="filmstrip-sidebar" data-slop-export="hide" aria-label="Slide Filmstrip">
        <div class="filmstrip-header">
          <span>SLIDES ({doc.current.slides.length})</span>
          <button
            type="button"
            class="add-slide-btn"
            title="Add Slide"
            onclick={addSlide}
          >
            <Plus size={12} />
          </button>
        </div>

        <div class="slides-list">
          {#each doc.current.slides as s, idx (s.id)}
            <div
              class="filmstrip-thumb"
              class:active={idx === doc.current.activeSlideIndex}
              onclick={() => selectSlide(idx)}
              role="button"
              tabindex="0"
              onkeydown={(e) => e.key === "Enter" && selectSlide(idx)}
            >
              <div class="thumb-meta">
                <span>{String(idx + 1).padStart(2, "0")} · {s.layout.toUpperCase()}</span>
                {#if doc.current.slides.length > 1}
                  <button
                    type="button"
                    class="thumb-delete-btn"
                    title="Delete slide"
                    onclick={(e) => {
                      e.stopPropagation();
                      deleteSlide(idx);
                    }}
                  >
                    <Trash2 size={11} />
                  </button>
                {/if}
              </div>
              <span class="thumb-title">{s.title || "Untitled"}</span>
            </div>
          {/each}
        </div>
      </aside>

      <!-- Center Stage Viewport -->
      <section class="stage-viewport" aria-label="Active Slide Stage">
        <div class="slide-canvas-frame">
          {#if currentSlide?.layout === "title"}
            <div class="layout-title-view">
              <input
                class="title-tag-input"
                aria-label="Category Tag"
                bind:value={currentSlide.tag}
                placeholder="TOPIC / TAG"
              />
              <input
                class="title-hero-input"
                aria-label="Hero Title"
                bind:value={currentSlide.title}
                placeholder="Presentation Title"
              />
              <input
                class="title-sub-input"
                aria-label="Subtitle"
                bind:value={currentSlide.subtitle}
                placeholder="Supporting description or takeaway"
              />
            </div>
          {:else if currentSlide?.layout === "split"}
            <div class="layout-split-view">
              <input
                class="slide-heading-input"
                aria-label="Slide Heading"
                bind:value={currentSlide.title}
                placeholder="Slide Heading"
              />
              <div class="split-columns">
                <div class="bullets-list">
                  {#each currentSlide.points || [] as pt, pIdx}
                    <input
                      class="bullet-item-input"
                      aria-label="Bullet Point"
                      bind:value={currentSlide.points![pIdx]}
                      placeholder="Bullet point..."
                    />
                  {/each}
                </div>
                <div class="highlight-card">
                  <input
                    class="highlight-tag"
                    aria-label="Highlight Tag"
                    bind:value={currentSlide.highlightLabel}
                    placeholder="TAG"
                  />
                  <input
                    class="highlight-number"
                    aria-label="Highlight Value"
                    bind:value={currentSlide.highlightValue}
                    placeholder="Stat / Value"
                  />
                  <textarea
                    class="highlight-text"
                    aria-label="Highlight Description"
                    bind:value={currentSlide.highlightDesc}
                    placeholder="Key impact note..."
                    rows="2"
                  ></textarea>
                </div>
              </div>
            </div>
          {:else if currentSlide?.layout === "metric"}
            <div class="layout-metric-view">
              <input
                class="title-tag-input"
                aria-label="Category Tag"
                bind:value={currentSlide.tag}
                placeholder="CATEGORY"
              />
              <input
                class="giant-metric-input"
                aria-label="Metric Stat"
                bind:value={currentSlide.metricValue}
                placeholder="10x"
              />
              <input
                class="metric-label-input"
                aria-label="Metric Label"
                bind:value={currentSlide.metricLabel}
                placeholder="KEY OUTCOME / METRIC"
              />
              <input
                class="title-sub-input"
                aria-label="Metric Description"
                bind:value={currentSlide.subtitle}
                placeholder="Contextual description of this metric"
                style="text-align: center;"
              />
            </div>
          {:else if currentSlide?.layout === "quote"}
            <div class="layout-quote-view">
              <textarea
                class="quote-textarea"
                aria-label="Quote Text"
                bind:value={currentSlide.quoteText}
                placeholder="Enter memorable quote or principle..."
                rows="3"
              ></textarea>
              <input
                class="quote-author-input"
                aria-label="Quote Author"
                bind:value={currentSlide.author}
                placeholder="— Author, Source"
              />
            </div>
          {:else if currentSlide?.layout === "cards"}
            <div class="layout-cards-view">
              <input
                class="slide-heading-input"
                aria-label="Slide Heading"
                bind:value={currentSlide.title}
                placeholder="Framework or Pillars"
              />
              <div class="cards-grid">
                {#each currentSlide.cards || [] as card, cIdx}
                  <div class="pillar-card">
                    <input
                      class="pillar-title-input"
                      aria-label="Card Title"
                      bind:value={currentSlide.cards![cIdx].title}
                      placeholder="Pillar Title"
                    />
                    <textarea
                      class="pillar-desc-textarea"
                      aria-label="Card Description"
                      bind:value={currentSlide.cards![cIdx].desc}
                      placeholder="Description of this pillar..."
                      rows="4"
                    ></textarea>
                  </div>
                {/each}
              </div>
            </div>
          {/if}
        </div>
      </section>
    </section>
  </article>

  <!-- Presenter Mode Fullscreen Overlay -->
  <Dialog.Root bind:open={isPresenting}>
    <Dialog.Portal>
      <Dialog.Content class="presenter-overlay" data-theme={doc.current.theme} aria-label="Presenter Mode">
        <Dialog.Title class="sr-only">Presenter Mode</Dialog.Title>
        <div class="presenter-slide-scaler">
          <div class="slide-canvas-frame" style="max-width: 100%; height: 100%;">
            {#if currentSlide?.layout === "title"}
              <div class="layout-title-view">
                <span class="title-tag-input">{currentSlide.tag}</span>
                <h1 class="title-hero-input">{currentSlide.title}</h1>
                <p class="title-sub-input">{currentSlide.subtitle}</p>
              </div>
            {:else if currentSlide?.layout === "split"}
              <div class="layout-split-view">
                <h2 class="slide-heading-input">{currentSlide.title}</h2>
                <div class="split-columns">
                  <div class="bullets-list">
                    {#each currentSlide.points || [] as pt}
                      <div class="bullet-item-input">{pt}</div>
                    {/each}
                  </div>
                  <div class="highlight-card">
                    <span class="highlight-tag">{currentSlide.highlightLabel}</span>
                    <div class="highlight-number">{currentSlide.highlightValue}</div>
                    <div class="highlight-text">{currentSlide.highlightDesc}</div>
                  </div>
                </div>
              </div>
            {:else if currentSlide?.layout === "metric"}
              <div class="layout-metric-view">
                <span class="title-tag-input">{currentSlide.tag}</span>
                <div class="giant-metric-input">{currentSlide.metricValue}</div>
                <div class="metric-label-input">{currentSlide.metricLabel}</div>
                <p class="title-sub-input" style="text-align: center;">{currentSlide.subtitle}</p>
              </div>
            {:else if currentSlide?.layout === "quote"}
              <div class="layout-quote-view">
                <blockquote class="quote-textarea">{currentSlide.quoteText}</blockquote>
                <div class="quote-author-input">— {currentSlide.author}</div>
              </div>
            {:else if currentSlide?.layout === "cards"}
              <div class="layout-cards-view">
                <h2 class="slide-heading-input">{currentSlide.title}</h2>
                <div class="cards-grid">
                  {#each currentSlide.cards || [] as card}
                    <div class="pillar-card">
                      <h3 class="pillar-title-input">{card.title}</h3>
                      <p class="pillar-desc-textarea">{card.desc}</p>
                    </div>
                  {/each}
                </div>
              </div>
            {/if}
          </div>
        </div>

        <!-- Floating Presenter HUD -->
        <nav class="presenter-hud" aria-label="Presenter Controls">
          <button
            type="button"
            class="hud-btn"
            onclick={prevSlide}
            disabled={doc.current.activeSlideIndex === 0}
          >
            <ChevronLeft size={16} />
          </button>
          <span>{doc.current.activeSlideIndex + 1} / {doc.current.slides.length}</span>
          <button
            type="button"
            class="hud-btn"
            onclick={nextSlide}
            disabled={doc.current.activeSlideIndex === doc.current.slides.length - 1}
          >
            <ChevronRight size={16} />
          </button>
          <span style="opacity: 0.4;">|</span>
          <span>⏱ {formattedTimer}</span>
          <span style="opacity: 0.4;">|</span>
          <Dialog.Close
            class="hud-btn"
            title="Exit Presenter (Esc)"
            onclick={stopPresenting}
          >
            <X size={16} />
          </Dialog.Close>
        </nav>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>
</main>

{#if capture.isRenderer()}
  <Icon />
{/if}
