<script lang="ts">
  import { ready } from "@hitslop/runtime";
  import { jsonStore, IconTarget, ExportTarget } from "@hitslop/svelte";
  import { Dialog } from "bits-ui";
  import { onDestroy } from "svelte";
  import { prefersReducedMotion } from "svelte/motion";
  import { flip } from "svelte/animate";
  import ArrowDown from "@lucide/svelte/icons/arrow-down";
  import ArrowLeft from "@lucide/svelte/icons/arrow-left";
  import ArrowRight from "@lucide/svelte/icons/arrow-right";
  import ArrowUp from "@lucide/svelte/icons/arrow-up";
  import Check from "@lucide/svelte/icons/check";
  import GripVertical from "@lucide/svelte/icons/grip-vertical";
  import Plus from "@lucide/svelte/icons/plus";
  import Trash2 from "@lucide/svelte/icons/trash-2";
  import X from "@lucide/svelte/icons/x";
  import boardSchema from "../schema";
  import type { Card, Lane } from "../schema";
  import Icon from "./Icon.svelte";
  import Export from "./Export.svelte";
  import * as s from "./styles.css";

  const board = jsonStore({
    schema: boardSchema,
    initial: {
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
    },
  });

  let draggingCardID = $state<string | null>(null);
  let dropLaneID = $state<string | null>(null);
  let armedLaneID = $state<string | null>(null);
  let draggingLaneID = $state<string | null>(null);
  let announcement = $state("");
  let composing = $state(false);
  let composingLaneId = $state<string | null>(null);
  let draftTitle = $state("");
  let draftNote = $state("");
  let draftTag = $state("");
  let titleField = $state<HTMLInputElement>();

  $effect(() => { if (board.isReady) ready(); });
  onDestroy(() => board.destroy());

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
  const composingLaneTitle = $derived(composingLaneId ? laneTitle(composingLaneId) : "lane");
  const flipMs = $derived(prefersReducedMotion.current ? 0 : 220);

  function cardsFor(laneID: string): Card[] { return laneCards.get(laneID) ?? []; }
  function isOverLimit(lane: Lane): boolean { return lane.limit !== null && lane.limit > 0 && cardsFor(lane.id).length > lane.limit; }
  function laneIndex(laneID: string): number { return board.current.lanes.findIndex((lane) => lane.id === laneID); }
  function nextOrder(laneID: string): number { return cardsFor(laneID).reduce((highest, card) => Math.max(highest, card.order + 1), 0); }
  function laneTitle(laneID: string): string { return board.current.lanes.find((lane) => lane.id === laneID)?.title.trim() || "lane"; }
  function isDone(laneID: string): boolean { return board.current.doneLaneId === laneID; }
  function pad(value: number): string { return String(value).padStart(2, "0"); }
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
  function openComposer(laneID: string): void {
    composingLaneId = laneID;
    draftTitle = "";
    draftNote = "";
    draftTag = "";
    composing = true;
  }
  function closeComposer(): void {
    composing = false;
    composingLaneId = null;
  }
  function punchTicket(): void {
    const title = draftTitle.trim();
    const laneID = composingLaneId;
    if (!title || !laneID || board.isLoading) return;
    board.current.cards.push({
      id: crypto.randomUUID(),
      laneId: laneID,
      title,
      note: draftNote.trim(),
      tag: draftTag.trim(),
      order: nextOrder(laneID),
    });
    announcement = `Work order punched into ${laneTitle(laneID)}.`;
    closeComposer();
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
  function onLaneDragOver(event: DragEvent, lane: Lane): void {
    if (draggingLaneID) {
      event.preventDefault();
      reorderLane(draggingLaneID, lane.id);
      return;
    }
    if (draggingCardID) {
      event.preventDefault();
      dropLaneID = lane.id;
    }
  }
</script>

<main class={s.canvas} data-slop-selection="none" aria-busy={board.isLoading} aria-label="Work-order board">
  <div class={s.chassis} inert={!board.isReady || board.isLoading}>
    <header class={s.rail}>
      <div class={s.railMark} aria-hidden="true"><span></span><span></span></div>
      <div class={s.railName}>
        <h1 class={s.srOnly}>{board.current.title.trim() || "Board"}</h1>
        <input class={s.railTitle} aria-label="Board name" bind:value={board.current.title} />
        <p class={s.railHint} data-slop-export="hide">Drag tickets between rails. Amber is over WIP.</p>
      </div>
      <dl class={s.railMeters}>
        <div><dt>Open</dt><dd>{pad(openCount)}</dd></div>
        <div><dt>Done</dt><dd>{pad(doneCount)}</dd></div>
        <div class={s.meterWip} data-alert={overLimitCount > 0} title="Amber lights when a rail holds more tickets than its WIP limit">
          <dt>Over WIP</dt>
          <dd>{pad(overLimitCount)}</dd>
        </div>
      </dl>
    </header>

    <div class={s.deck}>
      {#each board.current.lanes as lane, index (lane.id)}
        {@const cards = cardsFor(lane.id)}
        <section
          class={s.lane}
          data-drop={dropLaneID === lane.id}
          data-over={isOverLimit(lane)}
          data-dragging={draggingLaneID === lane.id}
          data-done={isDone(lane.id)}
          aria-label="{lane.title} lane, {cards.length} work orders{lane.limit ? `, WIP ${cards.length} of ${lane.limit}` : ""}{isOverLimit(lane) ? ", over limit" : ""}"
          draggable={armedLaneID === lane.id}
          ondragstart={(event) => { if (armedLaneID !== lane.id) return; draggingLaneID = lane.id; event.dataTransfer?.setData("text/plain", lane.id); }}
          ondragend={() => { draggingLaneID = null; armedLaneID = null; dropLaneID = null; }}
          onpointerup={() => { armedLaneID = null; }}
          ondragover={(event) => onLaneDragOver(event, lane)}
          ondragleave={() => { if (dropLaneID === lane.id) dropLaneID = null; }}
          ondrop={(event) => { event.preventDefault(); if (draggingLaneID) { announcement = `${laneTitle(draggingLaneID)} is now lane ${laneIndex(draggingLaneID) + 1} of ${board.current.lanes.length}.`; draggingLaneID = null; armedLaneID = null; return; } dropOnLane(lane.id); }}
        >
          <header class={s.laneHead}>
            <button
              type="button"
              class={s.laneGrip}
              data-slop-export="hide"
              aria-label="Reorder {lane.title} lane, position {index + 1} of {board.current.lanes.length}"
              title="Drag to reorder rails, or use the arrow keys"
              onpointerdown={() => { armedLaneID = lane.id; }}
              onblur={() => { if (armedLaneID === lane.id && !draggingLaneID) armedLaneID = null; }}
              onkeydown={(event) => {
                if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
                event.preventDefault();
                nudgeLane(lane.id, event.key === "ArrowLeft" ? -1 : 1);
                queueMicrotask(() => event.currentTarget?.focus());
              }}
            ><GripVertical size={13} /></button>
            <input class={s.laneTitle} aria-label="Lane {index + 1} name" bind:value={lane.title} />
            <button
              type="button"
              class={s.laneDoneToggle}
              data-slop-export={isDone(lane.id) ? undefined : "hide"}
              aria-pressed={isDone(lane.id)}
              aria-label="Mark {lane.title} as the completed lane"
              title={isDone(lane.id) ? "This is the completed lane" : "Mark as the completed lane"}
              onclick={() => toggleDoneLane(lane.id)}
            ><Check size={11} strokeWidth={3.5} /></button>
            <label class={s.laneLimit} title="Work-in-progress limit — how many tickets this rail can hold at once">
              <span class={s.wipLamp} data-alert={isOverLimit(lane)} aria-hidden="true"></span>
              <span class={s.wipLabel}>WIP</span>
              <span class={s.laneCount}>{pad(cards.length)}</span>
              <span class={s.laneSlash} aria-hidden="true">/</span>
              <input class={s.laneLimitInput} aria-label="{lane.title} work-in-progress limit" type="number" min="0" placeholder="–" bind:value={lane.limit} />
            </label>
            <button
              type="button"
              class={s.laneRemove}
              data-slop-export="hide"
              aria-label="Remove {lane.title} lane"
              title={cards.length > 0 ? `Remove this lane — ${cards.length} ${cards.length === 1 ? "order moves" : "orders move"} to the neighbouring lane` : "Remove this lane"}
              disabled={board.current.lanes.length < 2}
              onclick={() => removeLane(lane.id)}
            ><X size={12} /></button>
          </header>

          <div class={s.laneSlot}>
            {#each cards as card, position (card.id)}
              <article
                class={s.ticket}
                data-dragging={draggingCardID === card.id}
                draggable="true"
                animate:flip={{ duration: flipMs }}
                ondragstart={(event) => { draggingCardID = card.id; event.dataTransfer?.setData("text/plain", card.id); }}
                ondragend={() => { draggingCardID = null; dropLaneID = null; }}
              >
                <div class={s.ticketStub} aria-hidden="true">
                  <span class={s.punch}></span>
                  <span class={s.ticketNo}>{pad(position + 1)}</span>
                </div>
                <div class={s.ticketBody}>
                  <textarea class={s.ticketTitle} rows="1" aria-label="Work order title" bind:value={card.title}></textarea>
                  <textarea class={s.ticketNote} rows="2" placeholder="Notes" aria-label="Work order notes" bind:value={card.note}></textarea>
                  <div class={s.ticketFoot}>
                    <input class={s.ticketTag} placeholder="tag" aria-label="Work order tag" bind:value={card.tag} />
                    <div class={s.ticketActions} data-slop-export="hide">
                      <button type="button" aria-label="Move to previous lane" disabled={index === 0} onclick={() => shiftLane(card.id, -1)}><ArrowLeft size={11} /></button>
                      <button type="button" aria-label="Move up in lane" disabled={position === 0} onclick={() => shiftWithinLane(card.id, -1)}><ArrowUp size={11} /></button>
                      <button type="button" aria-label="Move down in lane" disabled={position === cards.length - 1} onclick={() => shiftWithinLane(card.id, 1)}><ArrowDown size={11} /></button>
                      <button type="button" aria-label="Move to next lane" disabled={index === board.current.lanes.length - 1} onclick={() => shiftLane(card.id, 1)}><ArrowRight size={11} /></button>
                      <button type="button" class={s.ticketRemove} aria-label="Remove work order" onclick={() => removeCard(card.id)}><Trash2 size={11} /></button>
                    </div>
                  </div>
                </div>
              </article>
            {/each}

            {#if cards.length === 0}
              <p class={s.laneEmpty}>Empty slot<span>Punch a work order to load this rail.</span></p>
            {/if}

            <button type="button" class={s.laneAdd} data-slop-export="hide" onclick={() => openComposer(lane.id)}><Plus size={12} />Punch ticket</button>
          </div>
        </section>
      {/each}

      <button type="button" class={s.deckAdd} data-slop-export="hide" aria-label="Add lane" title="Add lane" onclick={addLane}><Plus size={14} /><span>Lane</span></button>
    </div>
  </div>

  {#if board.error}
    <div class={s.error} role="alert" data-slop-export="hide">
      <span>{board.isReady ? "Your latest changes couldn’t be saved." : "The board couldn’t be loaded."} {board.error}</span>
      <button type="button" onclick={() => { if (board.isReady) void board.flush().catch(() => undefined); else void board.reload(); }}>Try again</button>
    </div>
  {:else if board.isLoading}
    <p class={s.error} role="status">Loading the board…</p>
  {/if}
  <p class={s.srOnly} role="status" aria-live="polite">{announcement}</p>
</main>

<Dialog.Root bind:open={composing} onOpenChange={(open) => { if (!open) composingLaneId = null; }}>
  <Dialog.Portal>
    <Dialog.Overlay class={s.overlay} data-slop-export="hide" />
    <Dialog.Content
      class={s.dialog}
      data-slop-export="hide"
      onOpenAutoFocus={(event) => { event.preventDefault(); queueMicrotask(() => titleField?.focus()); }}
    >
      <div class={s.dialogHead}>
        <div>
          <p class={s.dialogEyebrow}>Work order</p>
          <Dialog.Title>Punch a ticket</Dialog.Title>
          <Dialog.Description>Slot this order into {composingLaneTitle}. Drag it to another rail when the work moves.</Dialog.Description>
        </div>
        <Dialog.Close class={s.dialogClose} aria-label="Close"><X size={14} /></Dialog.Close>
      </div>
      <form class={s.dialogForm} onsubmit={(event) => { event.preventDefault(); punchTicket(); }}>
        <label class={s.formField}>
          <span>Job title</span>
          <input bind:this={titleField} bind:value={draftTitle} placeholder="Rebuild the spindle jig" required />
        </label>
        <label class={s.formField}>
          <span>Notes</span>
          <textarea rows="3" bind:value={draftNote} placeholder="Setup, parts, or hold-ups"></textarea>
        </label>
        <label class={s.formField}>
          <span>Tag</span>
          <input bind:value={draftTag} placeholder="shop" />
        </label>
        <div class={s.dialogActions}>
          <button class={s.btnSecondary} type="button" onclick={closeComposer}>Cancel</button>
          <button class={s.btnPrimary} type="submit" disabled={!draftTitle.trim() || board.isLoading}>Slot ticket</button>
        </div>
      </form>
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>

<IconTarget><Icon alert={overLimitCount > 0} /></IconTarget>
<ExportTarget><Export data={board.current} /></ExportTarget>
