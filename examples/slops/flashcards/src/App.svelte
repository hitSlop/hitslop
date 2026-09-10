<script lang="ts">
  import { capture, ready } from "@hitslop/runtime";
  import { jsonStore, IconTarget, ExportTarget } from "@hitslop/svelte";
  import { Button, Dialog, Select, Tabs } from "bits-ui";
  import { onDestroy, onMount, tick, untrack } from "svelte";
  import { Tween, prefersReducedMotion } from "svelte/motion";
  import { cubicOut } from "svelte/easing";
  import RotateCw from "@lucide/svelte/icons/rotate-cw";
  import Layers from "@lucide/svelte/icons/layers";
  import Check from "@lucide/svelte/icons/check";
  import ChevronDown from "@lucide/svelte/icons/chevron-down";
  import Pencil from "@lucide/svelte/icons/pencil";
  import Plus from "@lucide/svelte/icons/plus";
  import Shuffle from "@lucide/svelte/icons/shuffle";
  import Trash2 from "@lucide/svelte/icons/trash-2";
  import X from "@lucide/svelte/icons/x";
  import flashcardsSchema from "../schema";
  import type { Flashcard } from "../schema";
  import Icon from "./Icon.svelte";
  import Export from "./Export.svelte";
  import * as s from "./styles.css";

  type LeitnerBox = 1 | 2 | 3 | 4;

  const FLIP_MS = 420;
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

  const store = jsonStore({
    schema: flashcardsSchema,
    initial: {
      decks: [{ id: "d-type", name: "Type Terms", cards: seedCards }],
      selectedDeckId: "d-type",
      selectedBox: 0,
      cardIndex: 0,
      flipped: false,
    },
  });

  let addingDeck = $state(false);
  let editing = $state(false);
  let editingExisting = $state(false);
  let draftFront = $state("");
  let draftBack = $state("");
  let draftDeck = $state("");
  let initialized = false;
  let lastCardId: string | null = null;

  const activeDeck = $derived(store.current.decks.find((deck) => deck.id === store.current.selectedDeckId) ?? store.current.decks[0] ?? null);
  const visibleCards = $derived.by(() => {
    const cards = activeDeck?.cards ?? [];
    if (store.current.selectedBox === 0) return cards;
    return cards.filter((card) => card.box === store.current.selectedBox);
  });
  const cardIndex = $derived(visibleCards.length === 0 ? 0 : Math.min(Math.max(0, store.current.cardIndex), visibleCards.length - 1));
  const currentCard = $derived(visibleCards[cardIndex] ?? null);
  const boxCounts = $derived.by(() => {
    const counts: Record<LeitnerBox, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
    for (const card of activeDeck?.cards ?? []) {
      const box = clampBox(card.box);
      counts[box] += 1;
    }
    return counts;
  });
  const boxLabel = $derived(currentCard ? (BOXES[clampBox(currentCard.box) - 1]?.label ?? "New") : "New");
  const rotationTarget = $derived(store.current.flipped ? 180 : 0);
  const rotation = new Tween(untrack(() => rotationTarget), { duration: FLIP_MS, easing: cubicOut });
  const deckItems = $derived(store.current.decks.map((deck) => ({ value: deck.id, label: deck.name })));
  const dialogOpen = $derived(addingDeck || editing);

  function clampBox(value: number): LeitnerBox {
    if (value <= 1) return 1;
    if (value >= 4) return 4;
    return value as LeitnerBox;
  }

  function setFlipped(next: boolean): void {
    store.current.flipped = next;
  }

  function selectDeck(id: string): void {
    store.current.selectedDeckId = id;
    store.current.selectedBox = 0;
    store.current.cardIndex = 0;
    setFlipped(false);
    editing = false;
  }

  function selectBox(box: number): void {
    store.current.selectedBox = box;
    store.current.cardIndex = 0;
    setFlipped(false);
  }

  function flipCard(): void {
    if (!currentCard || dialogOpen || store.isLoading) return;
    setFlipped(!store.current.flipped);
  }

  function grade(good: boolean): void {
    if (!currentCard || dialogOpen || !store.current.flipped || !store.isReady) return;
    const previousIndex = cardIndex;
    const nextId = visibleCards[(cardIndex + 1) % visibleCards.length]?.id;
    const gradedId = currentCard.id;
    currentCard.box = good ? Math.min(4, currentCard.box + 1) : Math.max(1, currentCard.box - 1);
    currentCard.lastReviewed = new Date().toISOString();
    setFlipped(false);
    const remaining = (activeDeck?.cards ?? []).filter(card => store.current.selectedBox === 0 || card.box === store.current.selectedBox);
    const nextIndex = nextId !== gradedId ? remaining.findIndex(card => card.id === nextId) : -1;
    store.current.cardIndex = nextIndex >= 0 ? nextIndex : Math.min(previousIndex, Math.max(0, remaining.length - 1));
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
    store.current.cardIndex = 0;
    setFlipped(false);
  }

  function startAdd(): void {
    draftFront = "";
    draftBack = "";
    editingExisting = false;
    editing = true;
  }

  function startEdit(): void {
    if (!currentCard) return;
    draftFront = currentCard.front;
    draftBack = currentCard.back;
    editingExisting = true;
    editing = true;
    setFlipped(false);
  }

  function saveCard(): void {
    if (!activeDeck) return;
    const front = draftFront.trim();
    const back = draftBack.trim();
    if (!front || !back) return;
    if (editingExisting && currentCard) {
      currentCard.front = front;
      currentCard.back = back;
    } else {
      activeDeck.cards.push({
        id: crypto.randomUUID(),
        front,
        back,
        box: 1,
        lastReviewed: null,
      });
      store.current.selectedBox = 0;
      store.current.cardIndex = activeDeck.cards.length - 1;
      setFlipped(false);
    }
    editing = false;
  }

  function removeCard(): void {
    if (!activeDeck || !currentCard) return;
    activeDeck.cards = activeDeck.cards.filter((card) => card.id !== currentCard.id);
    setFlipped(false);
    store.current.cardIndex = Math.min(store.current.cardIndex, Math.max(0, activeDeck.cards.length - 1));
  }

  function addDeck(): void {
    const name = draftDeck.trim();
    if (!name) return;
    const id = crypto.randomUUID();
    store.current.decks.push({ id, name, cards: [] });
    store.current.selectedDeckId = id;
    store.current.selectedBox = 0;
    store.current.cardIndex = 0;
    setFlipped(false);
    draftDeck = "";
    addingDeck = false;
  }

  function handleKeyDown(event: KeyboardEvent): void {
    if (event.target instanceof HTMLElement && event.target.closest('input, textarea, select, [role="combobox"], [role="tab"], [role="option"], [contenteditable="true"]')) return;
    if (event.altKey || event.ctrlKey || event.metaKey || event.repeat) return;
    if (dialogOpen) return;
    if (event.code === "Space") {
      if (event.target instanceof HTMLElement && event.target.closest('button, [role="button"]')) return;
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

  $effect(() => { if (store.isReady) ready(); });
  $effect(() => {
    const cardId = currentCard?.id ?? null;
    const cardChanged = lastCardId !== null && cardId !== lastCardId;
    lastCardId = cardId;
    const instant = !initialized || !store.isReady || prefersReducedMotion.current || cardChanged;
    void rotation.set(rotationTarget, { duration: instant ? 0 : FLIP_MS, delay: 0 });
    initialized = store.isReady;
  });
  onMount(() => {
    window.addEventListener("keydown", handleKeyDown);
    const unregister = capture.onPrepare(async () => {
      await rotation.set(rotationTarget, { duration: 0, delay: 0 });
      await tick();
    });
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      unregister();
    };
  });
  onDestroy(() => {
    void rotation.set(rotation.target, { duration: 0, delay: 0 });
    store.destroy();
  });
</script>

<main class={s.catalogShell} data-slop-selection="none" aria-busy={store.isLoading} aria-label="Flashcard study machine">
  <header class={s.drawerHead}>
    <span class={s.deckMark} aria-hidden="true"><Layers size={23} /></span>
    <div class={s.brassPlate}>
      <Select.Root
        type="single"
        value={activeDeck?.id}
        items={deckItems}
        onValueChange={(value) => { if (value) selectDeck(value); }}
      >
        <Select.Trigger class={s.deckSelect} aria-label="Study deck">
          <span>{activeDeck?.name ?? "Select deck"}</span>
          <ChevronDown size={14} strokeWidth={2.4} data-slop-export="hide" />
        </Select.Trigger>
        <Select.Portal>
          <Select.Content class={s.selectContent} data-slop-export="hide" sideOffset={6}>
            <Select.Viewport>
              {#each store.current.decks as deck (deck.id)}
                <Select.Item value={deck.id} label={deck.name}>
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
    </div>
    <Button.Root
      type="button"
      class={s.iconBtn}
      data-slop-export="hide"
      onclick={() => { addingDeck = true; draftDeck = ""; }}
      aria-label="Add deck"
    >
      <Plus size={16} />
    </Button.Root>
  </header>

  <Tabs.Root
    value={String(store.current.selectedBox)}
    onValueChange={(value) => {
      if (value === undefined) return;
      const box = Number(value);
      if (box >= 0 && box <= 4) selectBox(box);
    }}
  >
    <Tabs.List class={s.boxRail} aria-label="Learning stages">
      <Tabs.Trigger value="0" class={s.boxTab}>
        All
        <strong>{activeDeck?.cards.length ?? 0}</strong>
      </Tabs.Trigger>
      {#each BOXES as box}
        <Tabs.Trigger value={String(box.id)} class={s.boxTab}>
          {box.label}
          <strong>{boxCounts[box.id]}</strong>
        </Tabs.Trigger>
      {/each}
    </Tabs.List>
  </Tabs.Root>

  <section class={s.studyWell}>
    {#if currentCard}
      <button
        type="button"
        class={s.cardStage}
        onclick={flipCard}
        aria-pressed={store.current.flipped}
        aria-label={store.current.flipped ? `Answer: ${currentCard.back}. Show question` : `Question: ${currentCard.front}. Show answer`}
      >
        <div class={s.cardInner} style:transform={`rotateY(${rotation.current}deg)`}>
          <div class={s.cardFace} aria-hidden={store.current.flipped}>
            <span class={s.cardIndex}>Question <span>{cardIndex + 1} / {visibleCards.length}</span></span>
            <strong>{currentCard.front}</strong>
            <em>Think it through. Tap to reveal.</em>
          </div>
          <div class={`${s.cardFace} ${s.cardBack}`} aria-hidden={!store.current.flipped}>
            <span class={s.cardIndex}>Answer <span>{boxLabel}</span></span>
            <strong>{currentCard.back}</strong>
            <em>How did you do?</em>
          </div>
        </div>
      </button>
    {:else}
      <div class={s.emptyDeck}>
        <strong>A fresh start</strong>
        <p>{store.current.selectedBox === 0 ? "Add a card to start this deck." : "Nothing in this box yet."}</p>
        <Button.Root type="button" class={s.emptyAction} data-slop-export="hide" onclick={() => { if (activeDeck) startAdd(); else addingDeck = true; }}>{activeDeck ? "Add a card" : "Create a deck"}</Button.Root>
      </div>
    {/if}
  </section>

  <footer class={s.studyBar} data-slop-export="hide">
    <div class={s.reviewActions}>
      {#if store.current.flipped && currentCard}
        <Button.Root type="button" class={`${s.grade} ${s.gradeAgain}`} onclick={() => grade(false)}><RotateCw size={16} />Again <kbd>1</kbd></Button.Root>
        <Button.Root type="button" class={`${s.grade} ${s.gradeGood}`} onclick={() => grade(true)}><Check size={16} />Got it <kbd>2</kbd></Button.Root>
      {:else}
        <Button.Root type="button" class={s.reveal} onclick={flipCard} disabled={!currentCard}>Reveal answer <kbd>Space</kbd></Button.Root>
      {/if}
    </div>
    <div class={s.tools}>
      <span>{currentCard ? `${cardIndex + 1} of ${visibleCards.length}` : "No cards"}</span>
      <Button.Root type="button" class={s.iconBtn} onclick={shuffleDeck} disabled={!activeDeck?.cards.length} aria-label="Shuffle deck"><Shuffle size={16} /></Button.Root>
      <Button.Root type="button" class={s.iconBtn} onclick={startEdit} disabled={!currentCard} aria-label="Edit card"><Pencil size={16} /></Button.Root>
      <Button.Root type="button" class={s.iconBtn} onclick={() => { if (activeDeck) startAdd(); else addingDeck = true; }} aria-label="Add card"><Plus size={16} /></Button.Root>
      <Button.Root type="button" class={`${s.iconBtn} ${s.iconDanger}`} onclick={removeCard} disabled={!currentCard} aria-label="Delete card"><Trash2 size={16} /></Button.Root>
    </div>
  </footer>

  {#if store.error}
    <div class={s.error} role="alert">
      <span>{store.isReady ? "Changes haven’t been saved." : "Your deck couldn’t be loaded."} {store.error}</span>
      <Button.Root type="button" data-slop-export="hide" onclick={() => { if (store.isReady) void store.flush().catch(() => undefined); else void store.reload(); }}>Try again</Button.Root>
    </div>
  {:else if store.isLoading}
    <p class={s.error} role="status">Loading your cards…</p>
  {/if}
</main>

<Dialog.Root bind:open={addingDeck}>
  <Dialog.Portal>
    <Dialog.Overlay class={s.dialogOverlay} data-slop-export="hide" />
    <Dialog.Content class={s.dialogCard} aria-labelledby="add-deck-title" data-slop-export="hide">
      <div class={s.dialogHead}>
        <Dialog.Title id="add-deck-title">New deck</Dialog.Title>
        <Dialog.Close class={s.dialogClose} aria-label="Close dialog"><X size={16} /></Dialog.Close>
      </div>
      <form onsubmit={(event) => { event.preventDefault(); addDeck(); }}>
        <label class={s.formField}>
          <span>DECK NAME</span>
          <input bind:value={draftDeck} placeholder="Typography" required />
        </label>
        <div class={s.dialogActions}>
          <Button.Root type="button" class={s.btnSecondary} onclick={() => { addingDeck = false; }}>Cancel</Button.Root>
          <Button.Root type="submit" class={s.btnPrimary}>Create deck</Button.Root>
        </div>
      </form>
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>

<Dialog.Root bind:open={editing}>
  <Dialog.Portal>
    <Dialog.Overlay class={s.dialogOverlay} data-slop-export="hide" />
    <Dialog.Content class={s.dialogCard} aria-labelledby="edit-card-title" data-slop-export="hide">
      <div class={s.dialogHead}>
        <Dialog.Title id="edit-card-title">{editingExisting ? "Edit card" : "New card"}</Dialog.Title>
        <Dialog.Close class={s.dialogClose} aria-label="Close dialog"><X size={16} /></Dialog.Close>
      </div>
      <form onsubmit={(event) => { event.preventDefault(); saveCard(); }}>
        <label class={s.formField}>
          <span>FRONT</span>
          <textarea bind:value={draftFront} rows="2" required></textarea>
        </label>
        <label class={s.formField}>
          <span>BACK</span>
          <textarea bind:value={draftBack} rows="2" required></textarea>
        </label>
        <div class={s.dialogActions}>
          <Button.Root type="button" class={s.btnSecondary} onclick={() => { editing = false; }}>Cancel</Button.Root>
          <Button.Root type="submit" class={s.btnPrimary}>{editingExisting ? "Save card" : "Add card"}</Button.Root>
        </div>
      </form>
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>

<IconTarget><Icon /></IconTarget>
<ExportTarget>
  <Export
    data={store.current}
    deckName={activeDeck?.name ?? "Flashcards"}
    boxLabel={boxLabel}
    boxCounts={boxCounts}
    total={activeDeck?.cards.length ?? 0}
    card={currentCard}
    cardIndex={cardIndex}
    cardCount={visibleCards.length}
    flipped={store.current.flipped}
  />
</ExportTarget>
