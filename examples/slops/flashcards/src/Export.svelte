<script lang="ts">
  import type { Flashcard, Flashcards } from "../schema";
  import * as s from "./styles.css";

  let {
    data,
    deckName,
    boxLabel,
    boxCounts,
    total,
    card,
    cardIndex,
    cardCount,
    flipped,
  }: {
    data: Flashcards;
    deckName: string;
    boxLabel: string;
    boxCounts: Record<1 | 2 | 3 | 4, number>;
    total: number;
    card: Flashcard | null;
    cardIndex: number;
    cardCount: number;
    flipped: boolean;
  } = $props();

  const BOXES = $derived([
    { id: 0 as const, label: "All", count: total },
    { id: 1 as const, label: "New", count: boxCounts[1] },
    { id: 2 as const, label: "Review", count: boxCounts[2] },
    { id: 3 as const, label: "Known", count: boxCounts[3] },
    { id: 4 as const, label: "Mastered", count: boxCounts[4] },
  ]);
</script>

<article class={s.exportShell} aria-label="Exported flashcards">
  <header class={s.drawerHead}>
    <div class={s.brassPlate}>
      <span class={s.deckSelect}><span>{deckName}</span></span>
    </div>
  </header>

  <div class={s.boxRail} aria-label="Learning stages">
    {#each BOXES as box}
      <span class={s.boxTab} data-state={data.selectedBox === box.id ? "active" : "inactive"}>
        {box.label}
        <strong>{box.count}</strong>
      </span>
    {/each}
  </div>

  <section class={s.studyWell}>
    {#if card}
      <div class={s.staticCard}>
        {#if flipped}
          <span class={s.cardIndex}>Answer · {boxLabel}</span>
          <strong>{card.back}</strong>
          <span class={s.cardIndex}></span>
        {:else}
          <span class={s.cardIndex}>Question · {cardIndex + 1} / {cardCount}</span>
          <strong>{card.front}</strong>
          <span class={s.cardIndex}></span>
        {/if}
      </div>
    {:else}
      <div class={s.emptyDeck}>
        <strong>A fresh start</strong>
        <p>Add a card to start this box.</p>
      </div>
    {/if}
  </section>
</article>
