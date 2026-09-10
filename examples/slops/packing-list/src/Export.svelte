<script lang="ts">
  import type { PackingList } from "../schema";
  import * as s from "./styles.css";

  let { list, filter }: { list: PackingList; filter: string } = $props();
  const categories = $derived(
    filter === "all" || filter === "remaining"
      ? list.categories
      : list.categories.filter(category => category.id === filter),
  );
  const packed = $derived(list.items.filter(item => item.packed).length);
  const total = $derived(list.items.length);
  const percent = $derived(total > 0 ? Math.round((packed / total) * 100) : 0);
  const complete = $derived(total > 0 && packed === total);

  function itemsFor(categoryId: string) {
    return list.items.filter(item => {
      if (item.categoryId !== categoryId) return false;
      if (filter === "remaining") return !item.packed;
      return true;
    });
  }
  function countsFor(categoryId: string) {
    const items = list.items.filter(item => item.categoryId === categoryId);
    return { total: items.length, packed: items.filter(item => item.packed).length };
  }
</script>

<article class={s.exportTag} aria-label="Exported packing list">
  <div class={s.airmail} aria-hidden="true"></div>
  <header class={s.header}>
    <div class={s.eyeletRow}>
      <span class={s.flagBtn} aria-hidden="true"><span class={s.flagEmoji}>{list.flag || "🇯🇵"}</span></span>
      <span class={s.airline}>HS-BAG // TRAVEL MANIFEST</span>
    </div>
    <div class={s.meta}>
      <div class={s.field}>
        <span class={s.metaLabel}>TRIP / EXPEDITION</span>
        <strong class={`${s.metaInput} ${s.titleInput}`}>{list.tripTitle || "Untitled trip"}</strong>
      </div>
      <div class={s.submeta}>
        <div class={s.field}>
          <span class={s.metaLabel}>DESTINATION</span>
          <strong class={`${s.metaInput} ${s.destInput}`}>{list.destination}</strong>
        </div>
        <div class={s.field}>
          <span class={s.metaLabel}>PASSENGER</span>
          <strong class={`${s.metaInput} ${s.passengerInput}`}>{list.traveler}</strong>
        </div>
        <div class={s.field}>
          <span class={s.metaLabel}>DEPARTURE</span>
          <strong class={`${s.metaInput} ${s.dateInput}`}>{list.departureDate}</strong>
        </div>
      </div>
    </div>
  </header>
  <section class={s.readiness}>
    <div class={s.readinessRow}>
      <div class={s.readinessStatus}>
        <span>BAGGAGE STATUS:</span>
        <span class={s.readyBadge} data-complete={complete}>{packed} / {total} PACKED ({percent}%)</span>
      </div>
    </div>
    <div class={s.track}><div class={s.fill} data-complete={complete} style:width="{percent}%"></div></div>
  </section>
  <div class={s.exportList}>
    {#each categories as category (category.id)}
      {@const items = itemsFor(category.id)}
      {@const counts = countsFor(category.id)}
      {#if items.length > 0}
        <section class={s.block} aria-label={category.name}>
          <div class={s.blockHead}>
            <span class={s.stamp} data-stamp={category.color}>{category.tagCode} // {category.name}</span>
            <span class={s.blockCount}>{counts.packed} of {counts.total} packed</span>
          </div>
          <ul class={s.list}>
            {#each items as item (item.id)}
              <li class={s.row} data-packed={item.packed}>
                <span data-checkbox-root data-state={item.packed ? "checked" : "unchecked"}>{#if item.packed}<span class={s.checkIcon}>✓</span>{/if}</span>
                <span class={s.qty}>×{item.quantity}</span>
                <span class={s.itemText}>{item.text || "Untitled item"}</span>
                <span class={s.star} data-active={item.essential}>{item.essential ? "★" : ""}</span>
              </li>
            {/each}
          </ul>
        </section>
      {/if}
    {:else}
      <div class={s.empty}><h2>Nothing to pack yet.</h2></div>
    {/each}
  </div>
  <footer class={s.footer}>
    <div class={s.barcodeBlock}>
      <div class={s.barcode} aria-hidden="true"></div>
      <span class={s.barcodeCode}>{list.bagTag} // CHECKED AIRLINE TAG</span>
    </div>
    <div class={s.footerStamp} data-complete={complete}>{complete ? "100% READY FOR FLIGHT" : "PACK IN PROGRESS"}</div>
  </footer>
</article>
