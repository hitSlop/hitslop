<script lang="ts">
  import { capture } from "@hitslop/runtime";
  import { jsonStore } from "@hitslop/svelte";
  import ArrowDown from "@lucide/svelte/icons/arrow-down";
  import ArrowLeft from "@lucide/svelte/icons/arrow-left";
  import ArrowRight from "@lucide/svelte/icons/arrow-right";
  import ArrowUp from "@lucide/svelte/icons/arrow-up";
  import Check from "@lucide/svelte/icons/check";
  import GripVertical from "@lucide/svelte/icons/grip-vertical";
  import Plus from "@lucide/svelte/icons/plus";
  import Trash2 from "@lucide/svelte/icons/trash-2";
  import X from "@lucide/svelte/icons/x";
  import { onDestroy } from "svelte";
  import Icon from "./Icon.svelte";

  type Lane = { id: string; title: string; limit: number | null };
  type Card = { id: string; laneId: string; title: string; note: string; tag: string; order: number };
  type Board = { title: string; doneLaneId: string | null; lanes: Lane[]; cards: Card[] };

  const board = jsonStore<Board>({
    title: "Work Order Board",
    doneLaneId: "shipped",
    lanes: [
      { id: "queued", title: "Queued", limit: null },
      { id: "running", title: "Running", limit: 3 },
      { id: "review", title: "Review", limit: 2 },
      { id: "shipped", title: "Shipped", limit: null },
    ],
    cards: [
      { id: "spindle", laneId: "queued", title: "Rebuild the spindle jig", note: "Waiting on the 12mm collet before setup can start.", tag: "shop", order: 0 },
      { id: "catalog", laneId: "queued", title: "Price the spring catalog", note: "Compare last season's margins first.", tag: "admin", order: 1 },
      { id: "anodize", laneId: "running", title: "Anodize the panel batch", note: "Bath is up to temperature; 40 pieces on the rack.", tag: "finish", order: 0 },
      { id: "wiring", laneId: "running", title: "Loom the control wiring", note: "", tag: "assembly", order: 1 },
      { id: "gauge", laneId: "review", title: "Check the gauge tolerances", note: "Two pieces sit 0.04mm over. Decide scrap or rework.", tag: "qa", order: 0 },
      { id: "crate", laneId: "shipped", title: "Crate the Hutton order", note: "Left on the Thursday truck.", tag: "logistics", order: 0 },
    ],
  });

  let draggingCardID = $state<string | null>(null);
  let dropLaneID = $state<string | null>(null);
  let armedLaneID = $state<string | null>(null);
  let draggingLaneID = $state<string | null>(null);
  let announcement = $state("");

  const laneCards = $derived.by(() => {
    const grouped = new Map<string, Card[]>();
    for (const lane of board.current.lanes) grouped.set(lane.id, []);
    for (const card of board.current.cards) grouped.get(card.laneId)?.push(card);
    for (const cards of grouped.values()) cards.sort((a, b) => a.order - b.order);
    return grouped;
  });
  const doneCount = $derived(board.current.doneLaneId ? cardsFor(board.current.doneLaneId).length : 0);
  const openCount = $derived(board.current.cards.length - doneCount);
  const overLimitCount = $derived(board.current.lanes.filter((lane) => isOverLimit(lane)).length);

  function cardsFor(laneID: string): Card[] { return laneCards.get(laneID) ?? []; }
  function isOverLimit(lane: Lane): boolean { return lane.limit !== null && lane.limit > 0 && cardsFor(lane.id).length > lane.limit; }
  function laneIndex(laneID: string): number { return board.current.lanes.findIndex((lane) => lane.id === laneID); }
  function nextOrder(laneID: string): number { return cardsFor(laneID).reduce((highest, card) => Math.max(highest, card.order + 1), 0); }
  function laneTitle(laneID: string): string { return board.current.lanes.find((lane) => lane.id === laneID)?.title.trim() || "lane"; }
  function isDone(laneID: string): boolean { return board.current.doneLaneId === laneID; }
  function toggleDoneLane(laneID: string): void {
    board.current.doneLaneId = isDone(laneID) ? null : laneID;
    announcement = board.current.doneLaneId ? `${laneTitle(laneID)} is now the completed lane.` : "No completed lane set.";
  }

  function addLane(): void {
    board.current.lanes.push({ id: crypto.randomUUID(), title: `Lane ${board.current.lanes.length + 1}`, limit: null });
    announcement = `Lane added. ${board.current.lanes.length} lanes on the board.`;
  }
  function removeLane(id: string): void {
    const index = laneIndex(id);
    const lane = board.current.lanes[index];
    if (!lane || board.current.lanes.length < 2) return;
    // Emptying a lane must never destroy work: its orders fall into the neighbour.
    const refuge = board.current.lanes[index === 0 ? 1 : index - 1];
    const stranded = cardsFor(id);
    let order = refuge ? nextOrder(refuge.id) : 0;
    for (const card of stranded) { if (refuge) { card.laneId = refuge.id; card.order = order++; } }
    board.current.lanes = board.current.lanes.filter((item) => item.id !== id);
    const moved = stranded.length === 0 ? "" : ` ${stranded.length} ${stranded.length === 1 ? "order" : "orders"} moved to ${refuge?.title.trim() || "the next lane"}.`;
    announcement = `${lane.title.trim() || "Lane"} removed.${moved}`;
  }
  function reorderLane(id: string, targetID: string): void {
    const from = laneIndex(id);
    const to = laneIndex(targetID);
    if (from < 0 || to < 0 || from === to) return;
    const [lane] = board.current.lanes.splice(from, 1);
    if (lane) board.current.lanes.splice(to, 0, lane);
  }
  function nudgeLane(id: string, direction: -1 | 1): void {
    const target = board.current.lanes[laneIndex(id) + direction];
    if (!target) return;
    reorderLane(id, target.id);
    announcement = `${laneTitle(id)} is now lane ${laneIndex(id) + 1} of ${board.current.lanes.length}.`;
  }
  function addCard(laneID: string): void {
    board.current.cards.push({ id: crypto.randomUUID(), laneId: laneID, title: "New work order", note: "", tag: "", order: nextOrder(laneID) });
    announcement = `Work order added to ${laneTitle(laneID)}.`;
  }
  function removeCard(id: string): void {
    const card = board.current.cards.find((item) => item.id === id);
    board.current.cards = board.current.cards.filter((item) => item.id !== id);
    if (card) announcement = `${card.title.trim() || "Work order"} removed.`;
  }
  function shiftLane(id: string, direction: -1 | 1): void {
    const card = board.current.cards.find((item) => item.id === id);
    if (!card) return;
    const target = board.current.lanes[laneIndex(card.laneId) + direction];
    if (!target) return;
    card.order = nextOrder(target.id);
    card.laneId = target.id;
    announcement = `${card.title.trim() || "Work order"} moved to ${target.title.trim() || "lane"}.`;
  }
  function shiftWithinLane(id: string, direction: -1 | 1): void {
    const card = board.current.cards.find((item) => item.id === id);
    if (!card) return;
    const siblings = cardsFor(card.laneId);
    const index = siblings.indexOf(card);
    const neighbour = siblings[index + direction];
    if (!neighbour) return;
    [card.order, neighbour.order] = [neighbour.order, card.order];
    announcement = `${card.title.trim() || "Work order"} is now position ${index + 1 + direction} in ${laneTitle(card.laneId)}.`;
  }
  function dropOnLane(laneID: string): void {
    const id = draggingCardID;
    draggingCardID = null;
    dropLaneID = null;
    const card = board.current.cards.find((item) => item.id === id);
    if (!card || card.laneId === laneID) return;
    card.order = nextOrder(laneID);
    card.laneId = laneID;
    announcement = `${card.title.trim() || "Work order"} moved to ${laneTitle(laneID)}.`;
  }

  onDestroy(() => board.destroy());
</script>

<main class="kanban-canvas" data-slop-selection="none">
  <div class="chassis">
    <header class="rail">
      <div class="rail-mark" aria-hidden="true"><span></span><span></span></div>
      <div class="rail-name">
        <h1 class="sr-only">{board.current.title.trim() || "Board"}</h1>
        <input class="rail-title" aria-label="Board name" bind:value={board.current.title} />
      </div>
      <dl class="rail-meters">
        <div><dt>Open</dt><dd>{String(openCount).padStart(2, "0")}</dd></div>
        <div><dt>Done</dt><dd>{String(doneCount).padStart(2, "0")}</dd></div>
        <div class="meter-wip" data-alert={overLimitCount > 0}><dt>Over WIP</dt><dd>{String(overLimitCount).padStart(2, "0")}</dd></div>
      </dl>
    </header>

    <div class="deck">
      {#each board.current.lanes as lane, index (lane.id)}
        {@const cards = cardsFor(lane.id)}
        <section
          class="lane"
          class:lane-drop={dropLaneID === lane.id}
          class:lane-over={isOverLimit(lane)}
          class:lane-dragging={draggingLaneID === lane.id}
          class:lane-done={isDone(lane.id)}
          aria-label="{lane.title} lane, {cards.length} work orders"
          draggable={armedLaneID === lane.id}
          ondragstart={(event) => { if (armedLaneID !== lane.id) return; draggingLaneID = lane.id; event.dataTransfer?.setData("text/plain", lane.id); }}
          ondragend={() => { draggingLaneID = null; armedLaneID = null; dropLaneID = null; }}
          onpointerup={() => { armedLaneID = null; }}
          ondragover={(event) => {
            if (draggingLaneID) { event.preventDefault(); reorderLane(draggingLaneID, lane.id); return; }
            if (draggingCardID) { event.preventDefault(); dropLaneID = lane.id; }
          }}
          ondragleave={() => { if (dropLaneID === lane.id) dropLaneID = null; }}
          ondrop={(event) => { event.preventDefault(); if (draggingLaneID) { announcement = `${laneTitle(draggingLaneID)} is now lane ${laneIndex(draggingLaneID) + 1} of ${board.current.lanes.length}.`; draggingLaneID = null; armedLaneID = null; return; } dropOnLane(lane.id); }}
        >
          <header class="lane-head">
            <button
              type="button"
              class="lane-grip"
              data-slop-export="hide"
              aria-label="Reorder {lane.title} lane, position {index + 1} of {board.current.lanes.length}"
              title="Drag to reorder, or use the arrow keys"
              onpointerdown={() => { armedLaneID = lane.id; }}
              onblur={() => { if (armedLaneID === lane.id && !draggingLaneID) armedLaneID = null; }}
              onkeydown={(event) => {
                if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
                event.preventDefault();
                nudgeLane(lane.id, event.key === "ArrowLeft" ? -1 : 1);
                queueMicrotask(() => event.currentTarget?.focus());
              }}
            ><GripVertical /></button>
            <input class="lane-title" aria-label="Lane {index + 1} name" bind:value={lane.title} />
            <button
              type="button"
              class="lane-done-toggle"
              data-slop-export={isDone(lane.id) ? undefined : "hide"}
              aria-pressed={isDone(lane.id)}
              aria-label="Mark {lane.title} as the completed lane"
              title={isDone(lane.id) ? "This is the completed lane" : "Mark as the completed lane"}
              onclick={() => toggleDoneLane(lane.id)}
            ><Check /></button>
            <label class="lane-limit" title="Work-in-progress limit">
              <span class="lane-count">{String(cards.length).padStart(2, "0")}</span>
              <span class="lane-slash" aria-hidden="true">/</span>
              <input aria-label="{lane.title} work-in-progress limit" type="number" min="0" placeholder="–" bind:value={lane.limit} />
            </label>
            <button
              type="button"
              class="lane-remove"
              data-slop-export="hide"
              aria-label="Remove {lane.title} lane"
              title={cards.length > 0 ? `Remove this lane — ${cards.length} ${cards.length === 1 ? "order moves" : "orders move"} to the neighbouring lane` : "Remove this lane"}
              disabled={board.current.lanes.length < 2}
              onclick={() => removeLane(lane.id)}
            ><X /></button>
          </header>

          <div class="lane-slot">
            {#each cards as card, position (card.id)}
              <article
                class="ticket"
                class:ticket-dragging={draggingCardID === card.id}
                draggable="true"
                ondragstart={(event) => { draggingCardID = card.id; event.dataTransfer?.setData("text/plain", card.id); }}
                ondragend={() => { draggingCardID = null; dropLaneID = null; }}
              >
                <div class="ticket-stub" aria-hidden="true">
                  <span class="punch"></span>
                  <span class="ticket-no">{String(position + 1).padStart(2, "0")}</span>
                </div>
                <div class="ticket-body">
                  <textarea class="ticket-title" rows="1" aria-label="Work order title" bind:value={card.title}></textarea>
                  <textarea class="ticket-note" rows="2" placeholder="Notes" aria-label="Work order notes" bind:value={card.note}></textarea>
                  <div class="ticket-foot">
                    <input class="ticket-tag" placeholder="tag" aria-label="Work order tag" bind:value={card.tag} />
                    <div class="ticket-actions" data-slop-export="hide">
                      <button type="button" aria-label="Move to previous lane" disabled={index === 0} onclick={() => shiftLane(card.id, -1)}><ArrowLeft /></button>
                      <button type="button" aria-label="Move up in lane" disabled={position === 0} onclick={() => shiftWithinLane(card.id, -1)}><ArrowUp /></button>
                      <button type="button" aria-label="Move down in lane" disabled={position === cards.length - 1} onclick={() => shiftWithinLane(card.id, 1)}><ArrowDown /></button>
                      <button type="button" aria-label="Move to next lane" disabled={index === board.current.lanes.length - 1} onclick={() => shiftLane(card.id, 1)}><ArrowRight /></button>
                      <button type="button" class="ticket-remove" aria-label="Remove work order" onclick={() => removeCard(card.id)}><Trash2 /></button>
                    </div>
                  </div>
                </div>
              </article>
            {/each}

            {#if cards.length === 0}
              <p class="lane-empty">Empty slot</p>
            {/if}

            <button type="button" class="lane-add" data-slop-export="hide" onclick={() => addCard(lane.id)}><Plus />Work order</button>
          </div>
        </section>
      {/each}

      <button type="button" class="deck-add" data-slop-export="hide" aria-label="Add lane" title="Add lane" onclick={addLane}><Plus /><span>Lane</span></button>
    </div>
  </div>

  {#if board.error}<p class="friendly-error" data-slop-export="hide">Your latest changes couldn’t be saved.</p>{/if}
  <p class="sr-only" role="status" aria-live="polite">{announcement}</p>
</main>

{#if capture.isRenderer()}
  <Icon />
{/if}
