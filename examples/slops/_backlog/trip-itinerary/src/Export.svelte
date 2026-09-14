<script lang="ts">
  import Check from "@lucide/svelte/icons/check";
  import Plane from "@lucide/svelte/icons/plane";
  import type { TripItinerary } from "../schema";
  import * as s from "./styles.css";

  let { trip }: { trip: TripItinerary } = $props();

  const TAGS: Record<string, string> = {
    flight: "FLT",
    hotel: "HTL",
    dining: "DINE",
    train: "RAIL",
    explore: "ACT",
  };
  const days = $derived(
    trip.days
      .map((day, index) => ({ day, index }))
      .sort((a, b) => {
        if (a.day.date && b.day.date && a.day.date !== b.day.date) return a.day.date.localeCompare(b.day.date);
        if (a.day.date && !b.day.date) return -1;
        if (!a.day.date && b.day.date) return 1;
        return a.index - b.index;
      })
      .map(item => item.day),
  );
  const packed = $derived(trip.stubItems.filter(item => item.done).length);

  function stopsFor(day: TripItinerary["days"][number]) {
    return day.events
      .map((event, index) => ({ event, index }))
      .sort((a, b) => {
        if (a.event.time !== b.event.time) return (a.event.time || "").localeCompare(b.event.time || "");
        return a.index - b.index;
      })
      .map(item => item.event);
  }
  function formatDate(iso: string): string {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
    if (!match) return iso;
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }
</script>

<article class={s.exportPass} aria-label="Exported trip itinerary">
  <div class={s.exportMain}>
    <header class={s.masthead}>
      <div class={s.mastTop}>
        <div class={s.airline}><Plane size={15} /><span>HITSLOP TRANSIT</span></div>
        <strong class={s.tripName}>{trip.tripTitle || "Untitled trip"}</strong>
      </div>
      <div class={s.route}>
        <div class={s.city}>
          <strong class={s.iata}>{trip.origin}</strong>
          <span class={s.cityName}>{trip.originCity}</span>
        </div>
        <div class={s.flightArrow} aria-hidden="true">
          <span class={s.flightLine}></span>
          <Plane size={16} />
          <span class={s.flightLine}></span>
        </div>
        <div class={`${s.city} ${s.cityEnd}`}>
          <strong class={s.iata}>{trip.destination}</strong>
          <span class={s.cityName}>{trip.destCity}</span>
        </div>
      </div>
      <div class={s.stripe}>
        <div class={s.field}><span>PASSENGER</span><strong>{trip.passenger}</strong></div>
        <div class={s.field}><span>FLIGHT</span><strong>{trip.flight}</strong></div>
        <div class={s.field}><span>GATE</span><strong>{trip.gate}</strong></div>
        <div class={s.field}><span>SEAT</span><strong>{trip.seat}</strong></div>
        <div class={s.field}><span>PNR</span><strong>{trip.bookingRef}</strong></div>
      </div>
    </header>

    {#each days as day (day.id)}
      {@const stops = stopsFor(day)}
      <section class={s.exportDay} aria-label={day.title}>
        <div class={s.exportDayHead}>
          <strong>{day.title}</strong>
          {#if day.date}<span>{formatDate(day.date)}</span>{/if}
          <span>{day.subtitle}</span>
        </div>
        <ul class={s.stops}>
          {#each stops as event (event.id)}
            <li class={s.stop} data-done={event.done}>
              <div class={s.timeStub}>
                <span data-checkbox-root data-state={event.done ? "checked" : "unchecked"}>{#if event.done}<Check size={12} strokeWidth={3.5} />{/if}</span>
                <span class={s.timeInput}>{event.time}</span>
              </div>
              <div class={s.stopBody}>
                <span class={s.stamp} data-tag={event.tag}>{TAGS[event.tag] ?? event.tag}</span>
                <div class={s.stopCopy}>
                  <span class={s.stopTitle}>{event.title || "Untitled stop"}</span>
                  <span class={s.stopLoc}>{event.location}</span>
                </div>
              </div>
            </li>
          {:else}
            <li class={s.empty}><p>No stops on this day.</p></li>
          {/each}
        </ul>
      </section>
    {:else}
      <div class={s.empty}><h2>No days in this booklet yet.</h2></div>
    {/each}
  </div>

  <div class={s.perforation} aria-hidden="true">
    <span class={`${s.notch} ${s.notchTop}`}></span>
    <span class={`${s.notch} ${s.notchBottom}`}></span>
  </div>

  <aside class={s.stub}>
    <div class={s.stubHead}>
      <span class={s.stubLabel}>BOARDING STUB</span>
      <strong class={s.stubRoute}>{trip.origin} ✈ {trip.destination}</strong>
    </div>
    <div class={s.stubMeta}>
      <div><span>FLIGHT</span><strong>{trip.flight}</strong></div>
      <div><span>GATE</span><strong>{trip.gate}</strong></div>
      <div><span>SEAT</span><strong>{trip.seat}</strong></div>
    </div>
    <div class={s.stubPassenger}>
      <span>NAME</span>
      <strong>{trip.passenger}</strong>
    </div>
    <div class={s.packing}>
      <span class={s.stubLabel}>PACKING STUB · {packed}/{trip.stubItems.length}</span>
      <ul class={s.stubItems}>
        {#each trip.stubItems as stub (stub.id)}
          <li class={s.stubRow} data-done={stub.done}>
            <span data-checkbox-root data-state={stub.done ? "checked" : "unchecked"}>{#if stub.done}<Check size={10} strokeWidth={3} />{/if}</span>
            <span class={s.stubText}>{stub.text || "Untitled item"}</span>
          </li>
        {:else}
          <li class={s.empty}><p>Nothing on the stub yet.</p></li>
        {/each}
      </ul>
    </div>
    <div class={s.barcodeBox} aria-hidden="true">
      <div class={s.barcode}></div>
      <span class={s.barcodeNum}>{trip.bookingRef}</span>
    </div>
  </aside>
</article>
