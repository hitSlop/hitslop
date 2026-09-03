<script lang="ts">
  import { capture } from "@hitslop/runtime";
  import { jsonStore } from "@hitslop/svelte";
  import Check from "@lucide/svelte/icons/check";
  import Plus from "@lucide/svelte/icons/plus";
  import Trash2 from "@lucide/svelte/icons/trash-2";
  import Plane from "@lucide/svelte/icons/plane";
  import { Checkbox, Select, Tabs, TimeField } from "bits-ui";
  import { Time } from "@internationalized/date";
  import Icon from "./Icon.svelte";

  type EventTag = "flight" | "hotel" | "dining" | "train" | "explore";

  type ItineraryEvent = {
    id: string;
    time: string;
    title: string;
    location: string;
    tag: EventTag;
    done: boolean;
  };

  type DayPlan = {
    id: string;
    title: string;
    subtitle: string;
    events: ItineraryEvent[];
  };

  type StubItem = {
    id: string;
    text: string;
    done: boolean;
  };

  type TripItineraryState = {
    tripTitle: string;
    origin: string;
    originCity: string;
    destination: string;
    destCity: string;
    bookingRef: string;
    passenger: string;
    flight: string;
    gate: string;
    seat: string;
    days: DayPlan[];
    selectedDayId: string;
    stubItems: StubItem[];
  };

  const TAGS: Array<{ id: EventTag; label: string; code: string }> = [
    { id: "flight", label: "Flight", code: "FLT" },
    { id: "hotel", label: "Hotel", code: "HTL" },
    { id: "dining", label: "Dining", code: "DINE" },
    { id: "train", label: "Transit", code: "RAIL" },
    { id: "explore", label: "Explore", code: "ACT" },
  ];

  const store = jsonStore<TripItineraryState>({
    tripTitle: "TOKYO AUTUMN TRIP",
    origin: "SFO",
    originCity: "SAN FRANCISCO",
    destination: "NRT",
    destCity: "TOKYO NARITA",
    bookingRef: "HS-8842",
    passenger: "JORDAN / PASSENGER",
    flight: "HS-774",
    gate: "B12",
    seat: "02A",
    selectedDayId: "d-1",
    days: [
      {
        id: "d-1",
        title: "DAY 01",
        subtitle: "Departure & Arrival",
        events: [
          { id: "e-1", time: "11:30", title: "Flight HS-774 Departure", location: "SFO Terminal 3 Gate 82", tag: "flight", done: true },
          { id: "e-2", time: "15:45", title: "Touchdown Tokyo Narita", location: "NRT Terminal 1", tag: "flight", done: true },
          { id: "e-3", time: "17:15", title: "Narita Express to Shibuya", location: "Platform 1", tag: "train", done: false },
          { id: "e-4", time: "19:00", title: "Hotel Check-in", location: "Shibuya Stream Hotel", tag: "hotel", done: false },
          { id: "e-5", time: "20:30", title: "Late Ramen Supper", location: "Ichiran Shibuya", tag: "dining", done: false },
        ],
      },
      {
        id: "d-2",
        title: "DAY 02",
        subtitle: "Meiji & Omotesando",
        events: [
          { id: "e-6", time: "08:30", title: "Morning walk at Meiji Jingu", location: "Harajuku Gate", tag: "explore", done: false },
          { id: "e-7", time: "11:00", title: "Coffee & Pastries", location: "Chatei Hatou", tag: "dining", done: false },
          { id: "e-8", time: "14:00", title: "Architecture & Boutiques", location: "Omotesando Hills", tag: "explore", done: false },
          { id: "e-9", time: "18:30", title: "Yakitori Dinner", location: "Omoide Yokocho", tag: "dining", done: false },
        ],
      },
      {
        id: "d-3",
        title: "DAY 03",
        subtitle: "Old Asakusa & Akihabara",
        events: [
          { id: "e-10", time: "09:00", title: "Senso-ji Temple grounds", location: "Asakusa", tag: "explore", done: false },
          { id: "e-11", time: "13:00", title: "Retro Electronics & Arcades", location: "Akihabara Electric Town", tag: "explore", done: false },
          { id: "e-12", time: "19:30", title: "Tonkatsu Dinner", location: "Katsukura", tag: "dining", done: false },
        ],
      },
    ],
    stubItems: [
      { id: "s-1", text: "Passport & Visas", done: true },
      { id: "s-2", text: "eSIM Activated", done: true },
      { id: "s-3", text: "Power Adapters", done: true },
      { id: "s-4", text: "Suica / IC Card loaded", done: false },
      { id: "s-5", text: "Pocket Wi-Fi picked up", done: false },
    ],
  });

  const activeDay = $derived(store.current.days.find((day) => day.id === store.current.selectedDayId) ?? store.current.days[0]);

  let newTime = $state("10:00");
  let newTitle = $state("");
  let newLocation = $state("");
  let newTag = $state<EventTag>("explore");
  let newStubText = $state("");

  function addEvent(): void {
    if (!activeDay || !newTitle.trim()) return;
    activeDay.events.push({
      id: crypto.randomUUID(),
      time: newTime,
      title: newTitle.trim(),
      location: newLocation.trim(),
      tag: newTag,
      done: false,
    });
    newTitle = "";
    newLocation = "";
  }

  function removeEvent(id: string): void {
    if (!activeDay) return;
    activeDay.events = activeDay.events.filter((event) => event.id !== id);
  }

  function addDay(): void {
    const dayNum = store.current.days.length + 1;
    const id = crypto.randomUUID();
    store.current.days.push({
      id,
      title: `DAY ${String(dayNum).padStart(2, "0")}`,
      subtitle: "Exploration & Activities",
      events: [],
    });
    store.current.selectedDayId = id;
  }

  function addStubItem(): void {
    const text = newStubText.trim();
    if (!text) return;
    store.current.stubItems.push({ id: crypto.randomUUID(), text, done: false });
    newStubText = "";
  }

  function removeStubItem(id: string): void {
    store.current.stubItems = store.current.stubItems.filter((item) => item.id !== id);
  }

  function tagCode(id: EventTag): string {
    return TAGS.find((tag) => tag.id === id)?.code ?? id.toUpperCase();
  }

  function toTimeVal(str: string): Time {
    const [h, m] = (str || "09:00").split(":").map(Number);
    return new Time(isNaN(h) ? 9 : h, isNaN(m) ? 0 : m);
  }
</script>

<main class="itinerary-shell" data-slop-selection="none">
  <article class="pass-card">
    <div class="pass-main">
      <header class="flight-masthead">
        <div class="masthead-top">
          <div class="airline-brand">
            <Plane size={15} />
            <span>HITSLOP TRANSIT</span>
          </div>
          <input class="trip-name" bind:value={store.current.tripTitle} aria-label="Trip name" />
        </div>

        <div class="route-banner">
          <div class="city-box">
            <input class="iata-input" bind:value={store.current.origin} aria-label="Origin code" maxlength="4" />
            <input class="city-input" bind:value={store.current.originCity} aria-label="Origin city" />
          </div>
          <div class="flight-arrow" aria-hidden="true">
            <span class="flight-line"></span>
            <Plane size={16} />
            <span class="flight-line"></span>
          </div>
          <div class="city-box right">
            <input class="iata-input" bind:value={store.current.destination} aria-label="Destination code" maxlength="4" />
            <input class="city-input" bind:value={store.current.destCity} aria-label="Destination city" />
          </div>
        </div>

        <div class="passenger-stripe">
          <label class="p-field">
            <span>PASSENGER</span>
            <input bind:value={store.current.passenger} aria-label="Passenger name" />
          </label>
          <label class="p-field">
            <span>FLIGHT</span>
            <input bind:value={store.current.flight} aria-label="Flight number" />
          </label>
          <label class="p-field">
            <span>GATE</span>
            <input bind:value={store.current.gate} aria-label="Gate" />
          </label>
          <label class="p-field">
            <span>SEAT</span>
            <input bind:value={store.current.seat} aria-label="Seat" />
          </label>
          <label class="p-field">
            <span>PNR</span>
            <input bind:value={store.current.bookingRef} aria-label="Booking reference" />
          </label>
        </div>
      </header>

      <Tabs.Root
        value={store.current.selectedDayId}
        onValueChange={(v) => { if (v) store.current.selectedDayId = v; }}
      >
        <Tabs.List class="day-tabs" aria-label="Trip days">
          {#each store.current.days as day (day.id)}
            <Tabs.Trigger
              value={day.id}
              class="day-tab"
            >
              <strong>{day.title}</strong>
              <span>{day.events.length}</span>
            </Tabs.Trigger>
          {/each}
          <button type="button" class="add-day-btn" data-slop-export="hide" onclick={addDay} aria-label="Add day">
            <Plus size={14} />
          </button>
        </Tabs.List>
      </Tabs.Root>

      {#if activeDay}
        <section class="timeline-area" aria-label={`Events for ${activeDay.title}`}>
          <div class="timeline-header">
            <input class="day-title-input" bind:value={activeDay.title} aria-label="Day title" />
            <input class="day-sub-input" bind:value={activeDay.subtitle} aria-label="Day theme" />
          </div>

          <form class="event-composer" data-slop-export="hide" onsubmit={(event) => { event.preventDefault(); addEvent(); }}>
            <TimeField.Root
              value={toTimeVal(newTime)}
              onValueChange={(t) => { if (t) newTime = `${String(t.hour).padStart(2, "0")}:${String(t.minute).padStart(2, "0")}`; }}
            >
              <TimeField.Input class="comp-time-field" aria-label="Stop time">
                {#snippet children({ segments })}
                  {#each segments as { part, value }}
                    <TimeField.Segment {part} class="comp-time-seg">
                      {value}
                    </TimeField.Segment>
                  {/each}
                {/snippet}
              </TimeField.Input>
            </TimeField.Root>
            <input type="text" bind:value={newTitle} placeholder="Stop title" class="comp-title" required />
            <input type="text" bind:value={newLocation} placeholder="Place or note" class="comp-loc" />
            <Select.Root
              type="single"
              bind:value={newTag}
            >
              <Select.Trigger class="comp-tag-select" aria-label="Stop type">
                <span>{tagCode(newTag)}</span>
              </Select.Trigger>
              <Select.Portal>
                <Select.Content class="tag-select-content" data-slop-export="hide">
                  <Select.Viewport>
                    {#each TAGS as tag}
                      <Select.Item value={tag.id} label={tag.code} class="tag-select-item">
                        {#snippet children({ selected })}
                          <span>{tag.code}</span>
                          {#if selected}<Check size={11} />{/if}
                        {/snippet}
                      </Select.Item>
                    {/each}
                  </Select.Viewport>
                </Select.Content>
              </Select.Portal>
            </Select.Root>
            <button type="submit" class="comp-add-btn" aria-label="Add stop"><Plus size={14} /></button>
          </form>

          {#if activeDay.events.length === 0}
            <p class="empty-day">No stops on this day yet.</p>
          {/if}

          <ul class="stops-list">
            {#each activeDay.events as event (event.id)}
              <li class="stop-row" class:done={event.done}>
                <Checkbox.Root
                  checked={event.done}
                  onCheckedChange={(c) => { event.done = !!c; }}
                  class="stop-check"
                  aria-label={event.done ? "Mark incomplete" : "Mark complete"}
                >
                  {#snippet children({ checked })}
                    {#if checked}
                      <Check size={12} strokeWidth={3.5} />
                    {/if}
                  {/snippet}
                </Checkbox.Root>
                <TimeField.Root
                  value={toTimeVal(event.time)}
                  onValueChange={(t) => { if (t) event.time = `${String(t.hour).padStart(2, "0")}:${String(t.minute).padStart(2, "0")}`; }}
                >
                  <TimeField.Input class="stop-time-field" aria-label="Stop time">
                    {#snippet children({ segments })}
                      {#each segments as { part, value }}
                        <TimeField.Segment {part} class="stop-time-seg">
                          {value}
                        </TimeField.Segment>
                      {/each}
                    {/snippet}
                  </TimeField.Input>
                </TimeField.Root>
                <span class="stop-tag" data-tag={event.tag}>{tagCode(event.tag)}</span>
                <div class="stop-desc">
                  <input class="stop-title" bind:value={event.title} aria-label="Stop title" />
                  <input class="stop-loc" bind:value={event.location} aria-label="Stop location" placeholder="Location" />
                </div>
                <button
                  type="button"
                  class="stop-del"
                  data-slop-export="hide"
                  onclick={() => removeEvent(event.id)}
                  aria-label={`Remove ${event.title}`}
                >
                  <Trash2 size={13} />
                </button>
              </li>
            {/each}
          </ul>
        </section>
      {/if}
    </div>

    <div class="perforation" aria-hidden="true">
      <span class="perf-notch top"></span>
      <div class="perf-dashes"></div>
      <span class="perf-notch bottom"></span>
    </div>

    <aside class="pass-stub">
      <div class="stub-header">
        <span class="stub-label">BOARDING STUB</span>
        <strong class="stub-route">{store.current.origin} ✈ {store.current.destination}</strong>
      </div>
      <div class="stub-meta">
        <div><span>FLIGHT</span><strong>{store.current.flight}</strong></div>
        <div><span>GATE</span><strong>{store.current.gate}</strong></div>
        <div><span>SEAT</span><strong>{store.current.seat}</strong></div>
      </div>
      <div class="stub-passenger-info">
        <span>NAME</span>
        <strong>{store.current.passenger}</strong>
      </div>
      <div class="stub-checklist">
        <span class="stub-section-title">PACKING STUB</span>
        <ul class="stub-items">
          {#each store.current.stubItems as stub (stub.id)}
            <li class="stub-row">
              <Checkbox.Root
                checked={stub.done}
                onCheckedChange={(c) => { stub.done = !!c; }}
                class="stub-box"
                aria-label={stub.text}
              >
                {#snippet children({ checked })}
                  {#if checked}
                    <Check size={10} strokeWidth={3} />
                  {/if}
                {/snippet}
              </Checkbox.Root>
              <input class="stub-text" class:crossed={stub.done} bind:value={stub.text} aria-label="Checklist item" />
              <button
                type="button"
                class="stub-del"
                data-slop-export="hide"
                onclick={() => removeStubItem(stub.id)}
                aria-label={`Remove ${stub.text}`}
              >×</button>
            </li>
          {/each}
        </ul>
        <form class="stub-add-form" data-slop-export="hide" onsubmit={(event) => { event.preventDefault(); addStubItem(); }}>
          <input bind:value={newStubText} placeholder="Add packing item" class="stub-add-input" />
        </form>
      </div>
      <div class="stub-barcode-box" aria-hidden="true">
        <div class="barcode-bars">
          <i></i><i class="w"></i><i></i><i></i><i class="w"></i><i></i><i class="w"></i><i></i><i></i>
          <i class="w"></i><i></i><i></i><i class="w"></i><i></i><i></i><i class="w"></i><i></i>
        </div>
        <span class="barcode-num">{store.current.bookingRef}</span>
      </div>
    </aside>
  </article>
</main>

{#if store.error}
  <p class="store-error">The itinerary could not be saved.</p>
{/if}

{#if capture.isRenderer()}
  <Icon />
{/if}
