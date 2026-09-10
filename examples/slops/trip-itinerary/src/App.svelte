<script lang="ts">
  import { ready } from "@hitslop/runtime";
  import { jsonStore, IconTarget, ExportTarget } from "@hitslop/svelte";
  import { onDestroy } from "svelte";
  import { prefersReducedMotion } from "svelte/motion";
  import { flip } from "svelte/animate";
  import { Tabs, Checkbox, Select, Button, Tooltip } from "bits-ui";
  import Check from "@lucide/svelte/icons/check";
  import ChevronDown from "@lucide/svelte/icons/chevron-down";
  import Plane from "@lucide/svelte/icons/plane";
  import Plus from "@lucide/svelte/icons/plus";
  import Trash2 from "@lucide/svelte/icons/trash-2";
  import itinerarySchema from "../schema";
  import type { StopTag, TripItinerary } from "../schema";
  import Icon from "./Icon.svelte";
  import Export from "./Export.svelte";
  import * as s from "./styles.css";

  type Day = TripItinerary["days"][number];
  type Stop = Day["events"][number];

  const TAGS = [
    { value: "flight", label: "Flight", code: "FLT" },
    { value: "hotel", label: "Hotel", code: "HTL" },
    { value: "dining", label: "Dining", code: "DINE" },
    { value: "train", label: "Transit", code: "RAIL" },
    { value: "explore", label: "Explore", code: "ACT" },
  ] as const;
  const tagItems = TAGS.map(tag => ({ value: tag.value, label: tag.code }));

  const doc = jsonStore({ schema: itinerarySchema, initial: {
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
        date: "2026-10-14",
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
        date: "2026-10-15",
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
        date: "2026-10-16",
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
  } });

  let newTime = $state("10:00");
  let newTitle = $state("");
  let newLocation = $state("");
  let newTag = $state<StopTag>("explore");
  let newStubText = $state("");
  let composer = $state<HTMLInputElement>();
  $effect(() => { if (doc.isReady) ready(); });
  onDestroy(() => doc.destroy());

  const orderedDays = $derived(orderDays(doc.current.days));
  const activeDay = $derived(doc.current.days.find(day => day.id === doc.current.selectedDayId) ?? doc.current.days[0]);
  const orderedStops = $derived(activeDay ? orderStops(activeDay.events) : []);
  const packedCount = $derived(doc.current.stubItems.filter(item => item.done).length);
  const packedTotal = $derived(doc.current.stubItems.length);
  const flipMs = $derived(prefersReducedMotion.current ? 0 : 220);

  function orderDays(days: Day[]): Day[] {
    return days
      .map((day, index) => ({ day, index }))
      .sort((a, b) => {
        if (a.day.date && b.day.date && a.day.date !== b.day.date) return a.day.date.localeCompare(b.day.date);
        if (a.day.date && !b.day.date) return -1;
        if (!a.day.date && b.day.date) return 1;
        return a.index - b.index;
      })
      .map(item => item.day);
  }
  function orderStops(events: Stop[]): Stop[] {
    return events
      .map((event, index) => ({ event, index }))
      .sort((a, b) => {
        if (a.event.time !== b.event.time) return (a.event.time || "").localeCompare(b.event.time || "");
        return a.index - b.index;
      })
      .map(item => item.event);
  }
  function isTag(value: string): value is StopTag {
    return TAGS.some(tag => tag.value === value);
  }
  function tagCode(id: StopTag): string {
    return TAGS.find(tag => tag.value === id)?.code ?? id.toUpperCase();
  }
  function nextDate(from: string): string {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(from);
    if (!match) return "";
    const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + 1);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }
  function addEvent(): void {
    if (!activeDay || !newTitle.trim() || doc.isLoading) return;
    activeDay.events.push({
      id: crypto.randomUUID(),
      time: newTime || "10:00",
      title: newTitle.trim(),
      location: newLocation.trim(),
      tag: newTag,
      done: false,
    });
    newTitle = "";
    newLocation = "";
    composer?.focus();
  }
  function removeEvent(id: string): void {
    if (!activeDay) return;
    activeDay.events = activeDay.events.filter(event => event.id !== id);
  }
  function addDay(): void {
    if (doc.isLoading) return;
    const last = orderedDays[orderedDays.length - 1];
    const id = crypto.randomUUID();
    doc.current.days.push({
      id,
      title: `DAY ${String(doc.current.days.length + 1).padStart(2, "0")}`,
      subtitle: "Exploration & Activities",
      date: last ? nextDate(last.date) : "",
      events: [],
    });
    doc.current.selectedDayId = id;
  }
  function removeDay(id: string): void {
    if (doc.current.days.length <= 1) return;
    doc.current.days = doc.current.days.filter(day => day.id !== id);
    if (doc.current.selectedDayId === id) doc.current.selectedDayId = doc.current.days[0].id;
  }
  function addStubItem(): void {
    const text = newStubText.trim();
    if (!text || doc.isLoading) return;
    doc.current.stubItems.push({ id: crypto.randomUUID(), text, done: false });
    newStubText = "";
  }
  function removeStubItem(id: string): void {
    doc.current.stubItems = doc.current.stubItems.filter(item => item.id !== id);
  }
  function dayCounts(day: Day): { done: number; total: number } {
    return { total: day.events.length, done: day.events.filter(event => event.done).length };
  }
</script>

<Tooltip.Provider>
<main class={s.pass} data-slop-selection="none" aria-busy={doc.isLoading} aria-label="Trip itinerary boarding pass">
  <article class={s.booklet} inert={!doc.isReady || doc.isLoading}>
    <div class={s.main}>
      <header class={s.masthead}>
        <div class={s.mastTop}>
          <div class={s.airline}><Plane size={15} /><span>HITSLOP TRANSIT</span></div>
          <input class={s.tripName} bind:value={doc.current.tripTitle} aria-label="Trip name" />
        </div>
        <div class={s.route}>
          <div class={s.city}>
            <input class={s.iata} bind:value={doc.current.origin} aria-label="Origin code" maxlength="4" />
            <input class={s.cityName} bind:value={doc.current.originCity} aria-label="Origin city" />
          </div>
          <div class={s.flightArrow} aria-hidden="true">
            <span class={s.flightLine}></span>
            <Plane size={16} />
            <span class={s.flightLine}></span>
          </div>
          <div class={`${s.city} ${s.cityEnd}`}>
            <input class={s.iata} bind:value={doc.current.destination} aria-label="Destination code" maxlength="4" />
            <input class={s.cityName} bind:value={doc.current.destCity} aria-label="Destination city" />
          </div>
        </div>
        <div class={s.stripe}>
          <label class={s.field}><span>PASSENGER</span><input bind:value={doc.current.passenger} aria-label="Passenger name" /></label>
          <label class={s.field}><span>FLIGHT</span><input bind:value={doc.current.flight} aria-label="Flight number" /></label>
          <label class={s.field}><span>GATE</span><input bind:value={doc.current.gate} aria-label="Gate" /></label>
          <label class={s.field}><span>SEAT</span><input bind:value={doc.current.seat} aria-label="Seat" /></label>
          <label class={s.field}><span>PNR</span><input bind:value={doc.current.bookingRef} aria-label="Booking reference" /></label>
        </div>
      </header>

      <Tabs.Root value={doc.current.selectedDayId} onValueChange={value => { if (value) doc.current.selectedDayId = value; }}>
        <Tabs.List class={s.dayTabs} aria-label="Trip days">
          {#each orderedDays as day (day.id)}
            {@const counts = dayCounts(day)}
            <Tabs.Trigger value={day.id} class={s.dayTab}>
              <strong>{day.title}</strong>
              <span>{counts.total ? `${counts.done}/${counts.total}` : "0"}</span>
            </Tabs.Trigger>
          {/each}
          <Button.Root class={s.addDay} type="button" data-slop-export="hide" onclick={addDay} aria-label="Add day" disabled={doc.isLoading}>
            <Plus size={14} />
          </Button.Root>
        </Tabs.List>
      </Tabs.Root>

      {#if activeDay}
        <section class={s.timeline} aria-label={`Stops for ${activeDay.title}`}>
          <div class={s.dayHead}>
            <input class={s.dayTitle} bind:value={activeDay.title} aria-label="Day title" />
            <input class={s.dayDate} type="date" bind:value={activeDay.date} aria-label="Day date" />
            <input class={s.daySub} bind:value={activeDay.subtitle} aria-label="Day theme" />
            {#if doc.current.days.length > 1}
              <Tooltip.Root>
                <Tooltip.Trigger class={s.remove} data-slop-export="hide" aria-label="Remove {activeDay.title}" onclick={() => removeDay(activeDay.id)}><Trash2 size={13} /></Tooltip.Trigger>
                <Tooltip.Portal>
                  <Tooltip.Content class={s.tooltip} sideOffset={6}>Tear this day from the booklet</Tooltip.Content>
                </Tooltip.Portal>
              </Tooltip.Root>
            {/if}
          </div>

          <form class={s.composer} data-slop-export="hide" onsubmit={event => { event.preventDefault(); addEvent(); }}>
            <input class={s.timeInput} type="time" bind:value={newTime} aria-label="Stop time" />
            <input bind:this={composer} class={s.compTitle} type="text" bind:value={newTitle} placeholder="Stop title" aria-label="Stop title" required />
            <input class={s.compLoc} type="text" bind:value={newLocation} placeholder="Place or note" aria-label="Stop place" />
            <Select.Root type="single" value={newTag} items={tagItems} onValueChange={value => { if (isTag(value)) newTag = value; }}>
              <Select.Trigger class={s.selectTrigger} aria-label="Stop type">
                <Select.Value placeholder="TAG" />
                <ChevronDown size={12} strokeWidth={2.2} />
              </Select.Trigger>
              <Select.Portal>
                <Select.Content class={s.selectContent} sideOffset={6} data-slop-export="hide">
                  <Select.Viewport>
                    {#each tagItems as item (item.value)}
                      <Select.Item value={item.value} label={item.label}>
                        {#snippet children({ selected })}
                          {item.label}{#if selected}<Check size={12} strokeWidth={2.4} />{/if}
                        {/snippet}
                      </Select.Item>
                    {/each}
                  </Select.Viewport>
                </Select.Content>
              </Select.Portal>
            </Select.Root>
            <Button.Root class={s.add} type="submit" aria-label="Add stop" disabled={!newTitle.trim() || doc.isLoading}><Plus size={14} /></Button.Root>
          </form>

          <ul class={s.stops}>
            {#each orderedStops as event (event.id)}
              <li class={s.stop} data-done={event.done} animate:flip={{ duration: flipMs }}>
                <div class={s.timeStub}>
                  <Checkbox.Root checked={event.done} onCheckedChange={checked => event.done = checked === true} aria-label={event.done ? `Mark ${event.title} incomplete` : `Mark ${event.title} complete`}>
                    {#snippet children({ checked })}{#if checked}<Check size={12} strokeWidth={3.5} />{/if}{/snippet}
                  </Checkbox.Root>
                  <input class={s.timeInput} type="time" bind:value={event.time} aria-label="Stop time" />
                </div>
                <div class={s.stopBody}>
                  <span class={s.stamp} data-tag={event.tag}>{tagCode(event.tag)}</span>
                  <div class={s.stopCopy}>
                    <input class={s.stopTitle} bind:value={event.title} aria-label="Stop title" />
                    <input class={s.stopLoc} bind:value={event.location} aria-label="Stop location" placeholder="Location" />
                  </div>
                </div>
                <Tooltip.Root>
                  <Tooltip.Trigger class={s.remove} data-slop-export="hide" aria-label="Remove {event.title}" onclick={() => removeEvent(event.id)}><Trash2 size={13} /></Tooltip.Trigger>
                  <Tooltip.Portal>
                    <Tooltip.Content class={s.tooltip} sideOffset={6}>Remove this stub</Tooltip.Content>
                  </Tooltip.Portal>
                </Tooltip.Root>
              </li>
            {:else}
              <li class={s.empty}>
                <h2>No stops on this coupon yet.</h2>
                <p>Add a flight, hotel, or place for {activeDay.title}.</p>
              </li>
            {/each}
          </ul>
        </section>
      {/if}
    </div>

    <div class={s.perforation} aria-hidden="true">
      <span class={`${s.notch} ${s.notchTop}`}></span>
      <span class={`${s.notch} ${s.notchBottom}`}></span>
    </div>

    <aside class={s.stub}>
      <div class={s.stubHead}>
        <span class={s.stubLabel}>BOARDING STUB</span>
        <strong class={s.stubRoute}>{doc.current.origin} ✈ {doc.current.destination}</strong>
      </div>
      <div class={s.stubMeta}>
        <div><span>FLIGHT</span><strong>{doc.current.flight}</strong></div>
        <div><span>GATE</span><strong>{doc.current.gate}</strong></div>
        <div><span>SEAT</span><strong>{doc.current.seat}</strong></div>
      </div>
      <div class={s.stubPassenger}>
        <span>NAME</span>
        <strong>{doc.current.passenger}</strong>
      </div>
      <div class={s.packing}>
        <span class={s.stubLabel}>PACKING STUB · {packedCount}/{packedTotal}</span>
        <ul class={s.stubItems}>
          {#each doc.current.stubItems as stub (stub.id)}
            <li class={s.stubRow} data-done={stub.done}>
              <Checkbox.Root checked={stub.done} onCheckedChange={checked => stub.done = checked === true} aria-label={stub.text}>
                {#snippet children({ checked })}{#if checked}<Check size={10} strokeWidth={3} />{/if}{/snippet}
              </Checkbox.Root>
              <input class={s.stubText} bind:value={stub.text} aria-label="Checklist item" />
              <button type="button" class={s.stubDel} data-slop-export="hide" onclick={() => removeStubItem(stub.id)} aria-label="Remove {stub.text}">×</button>
            </li>
          {:else}
            <li class={s.empty}><p>Nothing on the stub yet.</p></li>
          {/each}
        </ul>
        <form data-slop-export="hide" onsubmit={event => { event.preventDefault(); addStubItem(); }}>
          <input class={s.stubAdd} bind:value={newStubText} placeholder="Add packing item" aria-label="Add packing item" />
        </form>
      </div>
      <div class={s.barcodeBox} aria-hidden="true">
        <div class={s.barcode}></div>
        <span class={s.barcodeNum}>{doc.current.bookingRef}</span>
      </div>
    </aside>
  </article>

  {#if doc.error}
    <div class={s.error} role="alert">
      <span>{doc.isReady ? "Changes haven’t been saved." : "Your itinerary couldn’t be loaded."} {doc.error}</span>
      <button data-slop-export="hide" onclick={() => { if (doc.isReady) void doc.flush().catch(() => undefined); else void doc.reload(); }}>Try again</button>
    </div>
  {:else if doc.isLoading}<p class={s.error} role="status">Loading your itinerary…</p>{/if}
</main>

<IconTarget>
  <Icon
    origin={doc.current.origin}
    originCity={doc.current.originCity}
    destination={doc.current.destination}
    destCity={doc.current.destCity}
    flight={doc.current.flight}
    gate={doc.current.gate}
    seat={doc.current.seat}
    packed={packedCount}
    total={packedTotal}
  />
</IconTarget>
<ExportTarget><Export trip={doc.current} /></ExportTarget>
</Tooltip.Provider>
