<script lang="ts">
  import type { Board, Card, Lane } from "../schema";
  import * as s from "./styles.css";

  let { data }: { data: Board } = $props();

  const grouped = $derived.by(() => {
    const map = new Map<string, Card[]>();
    for (const lane of data.lanes) map.set(lane.id, []);
    for (const card of data.cards) map.get(card.laneId)?.push(card);
    for (const cards of map.values()) cards.sort((a, b) => a.order - b.order);
    return map;
  });
  const doneCount = $derived(data.doneLaneId ? (grouped.get(data.doneLaneId)?.length ?? 0) : 0);
  const openCount = $derived(data.cards.length - doneCount);
  const overLimitCount = $derived(data.lanes.filter((lane) => isOverLimit(lane)).length);

  function cardsFor(laneID: string): Card[] { return grouped.get(laneID) ?? []; }
  function isOverLimit(lane: Lane): boolean {
    return lane.limit !== null && lane.limit > 0 && cardsFor(lane.id).length > lane.limit;
  }
  function pad(value: number): string { return String(value).padStart(2, "0"); }
  function limitLabel(lane: Lane): string {
    return lane.limit === null ? "–" : String(lane.limit);
  }
</script>

<article class={s.exportCanvas} aria-label="Exported work-order board">
  <div class={s.chassis}>
    <header class={s.rail}>
      <div class={s.railMark} aria-hidden="true"><span></span><span></span></div>
      <div class={s.railName}>
        <h1 class={s.railTitle}>{data.title.trim() || "Work Order Board"}</h1>
      </div>
      <dl class={s.railMeters}>
        <div><dt>Open</dt><dd>{pad(openCount)}</dd></div>
        <div><dt>Done</dt><dd>{pad(doneCount)}</dd></div>
        <div class={s.meterWip} data-alert={overLimitCount > 0}><dt>Over WIP</dt><dd>{pad(overLimitCount)}</dd></div>
      </dl>
    </header>

    <div class={s.deck}>
      {#each data.lanes as lane (lane.id)}
        {@const cards = cardsFor(lane.id)}
        <section class={s.lane} data-over={isOverLimit(lane)} data-done={data.doneLaneId === lane.id} aria-label="{lane.title} lane">
          <header class={s.laneHead}>
            <h2 class={s.laneTitle}>{lane.title}</h2>
            <span class={s.laneLimit}>
              <span class={s.wipLamp} data-alert={isOverLimit(lane)} aria-hidden="true"></span>
              <span class={s.wipLabel}>WIP</span>
              <span class={s.laneCount}>{pad(cards.length)}</span>
              {#if lane.limit !== null}
                <span class={s.laneSlash} aria-hidden="true">/</span>
                <span class={s.laneLimitInput}>{limitLabel(lane)}</span>
              {/if}
            </span>
          </header>
          <div class={s.laneSlot}>
            {#each cards as card, position (card.id)}
              <article class={s.ticket}>
                <div class={s.ticketStub} aria-hidden="true">
                  <span class={s.punch}></span>
                  <span class={s.ticketNo}>{pad(position + 1)}</span>
                </div>
                <div class={s.ticketBody}>
                  <p class={s.ticketTitle}>{card.title.trim() || "Untitled work order"}</p>
                  {#if card.note.trim()}
                    <p class={s.ticketNote}>{card.note}</p>
                  {/if}
                  {#if card.tag.trim()}
                    <div class={s.ticketFoot}><span class={s.ticketTag}>{card.tag}</span></div>
                  {/if}
                </div>
              </article>
            {:else}
              <p class={s.laneEmpty}>Empty slot</p>
            {/each}
          </div>
        </section>
      {/each}
    </div>
  </div>
</article>
