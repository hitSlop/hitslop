<script lang="ts">
  import { capture } from "@hitslop/runtime";
  import { jsonStore } from "@hitslop/svelte";
  import Check from "@lucide/svelte/icons/check";
  import Plus from "@lucide/svelte/icons/plus";
  import RotateCcw from "@lucide/svelte/icons/rotate-ccw";
  import Shuffle from "@lucide/svelte/icons/shuffle";
  import Trash2 from "@lucide/svelte/icons/trash-2";
  import { Select, Tabs } from "bits-ui";
  import { onDestroy, onMount } from "svelte";
  import Icon from "./Icon.svelte";

  type LeitnerBox = 1 | 2 | 3 | 4;

  type Flashcard = {
    id: string;
    front: string;
    back: string;
    box: LeitnerBox;
    lastReviewed: string | null;
  };

  type Deck = {
    id: string;
    name: string;
    cards: Flashcard[];
  };

  type FlashcardsState = {
    decks: Deck[];
    selectedDeckId: string;
    selectedBox: LeitnerBox | 0;
  };

  const BOXES: Array<{ id: LeitnerBox; label: string }> = [
    { id: 1, label: "New" },
    { id: 2, label: "Review" },
    { id: 3, label: "Known" },
    { id: 4, label: "Mastered" },
  ];

  const seedCards: Flashcard[] = [
    { id: "c-1", front: "Kerning", back: "The space between a specific pair of letters.", box: 1, lastReviewed: null },
    { id: "c-2", front: "Leading", back: "Vertical space from one baseline to the next.", box: 1, lastReviewed: null },
    { id: "c-3", front: "X-height", back: "The height of lowercase letters, excluding ascenders.", box: 2, lastReviewed: null },
    { id: "c-4", front: "Ligature", back: "Two or more letters drawn as a single glyph.", box: 2, lastReviewed: null },
    { id: "c-5", front: "Counter", back: "The enclosed or partially enclosed interior of a letter.", box: 3, lastReviewed: null },
    { id: "c-6", front: "Serif", back: "A small finishing stroke on the end of a letter stem.", box: 4, lastReviewed: null },
  ];

  const store = jsonStore<FlashcardsState>({
    decks: [{ id: "d-type", name: "Type Terms", cards: seedCards }],
    selectedDeckId: "d-type",
    selectedBox: 0,
  });

  let flipped = $state(false);
  let cardIndex = $state(0);
  let editing = $state(false);
  let addingDeck = $state(false);
  let draftFront = $state("");
  let draftBack = $state("");
  let draftDeck = $state("");

  const activeDeck = $derived(store.current.decks.find((deck) => deck.id === store.current.selectedDeckId) ?? store.current.decks[0]);
  const visibleCards = $derived.by(() => {
    const cards = activeDeck?.cards ?? [];
    if (store.current.selectedBox === 0) return cards;
    return cards.filter((card) => card.box === store.current.selectedBox);
  });
  const currentCard = $derived(visibleCards[Math.min(cardIndex, Math.max(0, visibleCards.length - 1))] ?? null);
  const boxCounts = $derived.by(() => {
    const counts: Record<LeitnerBox, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
    for (const card of activeDeck?.cards ?? []) counts[card.box] += 1;
    return counts;
  });

  function clampIndex(): void {
    if (visibleCards.length === 0) {
      cardIndex = 0;
      return;
    }
    if (cardIndex >= visibleCards.length) cardIndex = 0;
  }

  $effect(() => {
    void visibleCards.length;
    clampIndex();
  });

  function selectDeck(id: string): void {
    store.current.selectedDeckId = id;
    cardIndex = 0;
    flipped = false;
    editing = false;
  }

  function selectBox(box: LeitnerBox | 0): void {
    store.current.selectedBox = box;
    cardIndex = 0;
    flipped = false;
  }

  function flipCard(): void {
    if (!currentCard || editing) return;
    flipped = !flipped;
  }

  function grade(good: boolean): void {
    if (!currentCard) return;
    currentCard.box = (good
      ? Math.min(4, currentCard.box + 1)
      : Math.max(1, currentCard.box - 1)) as LeitnerBox;
    currentCard.lastReviewed = new Date().toISOString();
    flipped = false;
    if (visibleCards.length <= 1) {
      cardIndex = 0;
      return;
    }
    cardIndex = (cardIndex + 1) % visibleCards.length;
  }

  function shuffleDeck(): void {
    if (!activeDeck) return;
    const cards = [...activeDeck.cards];
    for (let i = cards.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      const a = cards[i]!;
      const b = cards[j]!;
      cards[i] = b;
      cards[j] = a;
    }
    activeDeck.cards = cards;
    cardIndex = 0;
    flipped = false;
  }

  function startEdit(): void {
    if (!currentCard) return;
    draftFront = currentCard.front;
    draftBack = currentCard.back;
    editing = true;
    flipped = false;
  }

  function saveEdit(): void {
    if (!currentCard) return;
    const front = draftFront.trim();
    const back = draftBack.trim();
    if (!front || !back) return;
    currentCard.front = front;
    currentCard.back = back;
    editing = false;
  }

  function addCard(): void {
    if (!activeDeck) return;
    const card: Flashcard = {
      id: crypto.randomUUID(),
      front: "New prompt",
      back: "Add the answer",
      box: 1,
      lastReviewed: null,
    };
    activeDeck.cards.push(card);
    store.current.selectedBox = 0;
    cardIndex = activeDeck.cards.length - 1;
    draftFront = card.front;
    draftBack = card.back;
    editing = true;
    flipped = false;
  }

  function removeCard(): void {
    if (!activeDeck || !currentCard) return;
    activeDeck.cards = activeDeck.cards.filter((card) => card.id !== currentCard.id);
    editing = false;
    flipped = false;
    clampIndex();
  }

  function addDeck(): void {
    const name = draftDeck.trim();
    if (!name) return;
    const id = crypto.randomUUID();
    store.current.decks.push({ id, name, cards: [] });
    store.current.selectedDeckId = id;
    draftDeck = "";
    addingDeck = false;
    cardIndex = 0;
    editing = false;
  }

  function handleKeyDown(event: KeyboardEvent): void {
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
    if (event.code === "Space") {
      event.preventDefault();
      flipCard();
    } else if (event.key === "1") {
      event.preventDefault();
      grade(false);
    } else if (event.key === "2") {
      event.preventDefault();
      grade(true);
    }
  }

  onMount(() => window.addEventListener("keydown", handleKeyDown));
  onDestroy(() => window.removeEventListener("keydown", handleKeyDown));
</script>

<main class="catalog-shell" data-slop-selection="none">
  <header class="drawer-head">
    <div class="brass-plate">
      {#if addingDeck}
        <form class="deck-add" data-slop-export="hide" onsubmit={(event) => { event.preventDefault(); addDeck(); }}>
          <input bind:value={draftDeck} placeholder="Deck name" aria-label="New deck name" />
        </form>
      {:else}
        <Select.Root
          type="single"
          value={activeDeck?.id}
          onValueChange={(val) => { if (val) selectDeck(val); }}
        >
          <Select.Trigger class="deck-select" aria-label="Study deck">
            <span>{activeDeck?.name ?? "Select Deck"}</span>
          </Select.Trigger>
          <Select.Portal>
            <Select.Content class="deck-select-content" data-slop-export="hide">
              <Select.Viewport>
                {#each store.current.decks as deck (deck.id)}
                  <Select.Item value={deck.id} label={deck.name} class="deck-select-item">
                    {#snippet children({ selected })}
                      <span>{deck.name}</span>
                      {#if selected}<Check size={12} />{/if}
                    {/snippet}
                  </Select.Item>
                {/each}
              </Select.Viewport>
            </Select.Content>
          </Select.Portal>
        </Select.Root>
      {/if}
    </div>
    <button
      type="button"
      class="icon-btn"
      data-slop-export="hide"
      onclick={() => { addingDeck = !addingDeck; draftDeck = ""; }}
      aria-label="Add deck"
    >
      <Plus size={16} />
    </button>
  </header>

  <Tabs.Root
    value={String(store.current.selectedBox)}
    onValueChange={(v) => { if (v !== undefined) selectBox(Number(v) as 0 | LeitnerBox); }}
  >
    <Tabs.List class="box-rail" aria-label="Leitner boxes">
      <Tabs.Trigger value="0" class="box-tab {store.current.selectedBox === 0 ? 'active' : ''}">
        All
        <strong>{activeDeck?.cards.length ?? 0}</strong>
      </Tabs.Trigger>
      {#each BOXES as box}
        <Tabs.Trigger
          value={String(box.id)}
          class="box-tab {store.current.selectedBox === box.id ? 'active' : ''}"
        >
          {box.label}
          <strong>{boxCounts[box.id]}</strong>
        </Tabs.Trigger>
      {/each}
    </Tabs.List>
  </Tabs.Root>

  <section class="study-well">
    {#if currentCard}
      {#if editing}
        <form class="editor" data-slop-export="hide" onsubmit={(event) => { event.preventDefault(); saveEdit(); }}>
          <label>
            <span>FRONT</span>
            <textarea bind:value={draftFront} rows="2" required></textarea>
          </label>
          <label>
            <span>BACK</span>
            <textarea bind:value={draftBack} rows="2" required></textarea>
          </label>
          <div class="editor-actions">
            <button type="submit">Save card</button>
            <button type="button" onclick={() => { editing = false; }}>Cancel</button>
          </div>
        </form>
      {:else}
        <button
          type="button"
          class="card-stage"
          class:flipped
          onclick={flipCard}
          aria-label={flipped ? "Show prompt" : "Show answer"}
        >
          <div class="card-inner">
            <div class="card-face front">
              <span class="card-index">#{cardIndex + 1} / {visibleCards.length}</span>
              <strong>{currentCard.front}</strong>
              <em>SPACE · FLIP</em>
            </div>
            <div class="card-face back">
              <span class="card-index">{BOXES[currentCard.box - 1]?.label}</span>
              <strong>{currentCard.back}</strong>
              <em>1 AGAIN · 2 GOOD</em>
            </div>
          </div>
        </button>
      {/if}
    {:else}
      <div class="empty-deck">
        <strong>Empty drawer</strong>
        <p>Add a card to start this box.</p>
      </div>
    {/if}
  </section>

  <footer class="study-bar" data-slop-export="hide">
    <button type="button" class="grade again" onclick={() => grade(false)} disabled={!currentCard}>Again</button>
    <button type="button" class="icon-btn" onclick={shuffleDeck} disabled={!activeDeck?.cards.length} aria-label="Shuffle deck">
      <Shuffle size={15} />
    </button>
    <button type="button" class="icon-btn" onclick={startEdit} disabled={!currentCard} aria-label="Edit card">
      <RotateCcw size={15} />
    </button>
    <button type="button" class="icon-btn" onclick={addCard} aria-label="Add card">
      <Plus size={15} />
    </button>
    <button type="button" class="icon-btn danger" onclick={removeCard} disabled={!currentCard} aria-label="Delete card">
      <Trash2 size={15} />
    </button>
    <button type="button" class="grade good" onclick={() => grade(true)} disabled={!currentCard}>
      <Check size={14} /> Good
    </button>
  </footer>
</main>

{#if store.error}
  <p class="store-error">The deck could not be saved.</p>
{/if}

{#if capture.isRenderer()}
  <Icon />
{/if}
