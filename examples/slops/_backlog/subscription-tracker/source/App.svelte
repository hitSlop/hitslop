<script lang="ts">
  import { capture } from "@hitslop/runtime";
  import { jsonStore } from "@hitslop/svelte";
  import CalendarDays from "@lucide/svelte/icons/calendar-days";
  import Pause from "@lucide/svelte/icons/pause";
  import Pencil from "@lucide/svelte/icons/pencil";
  import Play from "@lucide/svelte/icons/play";
  import Plus from "@lucide/svelte/icons/plus";
  import Trash2 from "@lucide/svelte/icons/trash-2";
  import X from "@lucide/svelte/icons/x";
  import { Dialog, Tabs } from "bits-ui";
  import Icon from "./Icon.svelte";

  type Currency = "USD" | "CAD" | "EUR" | "GBP" | "AUD" | "JPY";
  type Cadence = "monthly" | "annual";
  type Category = "Entertainment" | "Work" | "Home" | "Health" | "Other";
  type Subscription = { id: string; name: string; amountMinor: number; cadence: Cadence; nextRenewal: string; category: Category; note: string; active: boolean };
  type Tracker = { currency: Currency; subscriptions: Subscription[] };

  const currencies: Currency[] = ["USD", "CAD", "EUR", "GBP", "AUD", "JPY"];
  const categories: Category[] = ["Entertainment", "Work", "Home", "Health", "Other"];
  const tracker = jsonStore<Tracker>({ currency: "USD", subscriptions: [] });
  let view = $state<"active" | "all">("active");
  let showDialog = $state(false);
  let editingId = $state<string | null>(null);
  let draft = $state<Subscription>(blankSubscription());

  const activeSubscriptions = $derived(tracker.current.subscriptions.filter((item) => item.active));
  const visibleSubscriptions = $derived(
    [...tracker.current.subscriptions]
      .filter((item) => view === "all" || item.active)
      .sort((a, b) => Number(b.active) - Number(a.active) || a.nextRenewal.localeCompare(b.nextRenewal) || a.name.localeCompare(b.name)),
  );
  const monthlyMinor = $derived(activeSubscriptions.reduce((total, item) => total + (item.cadence === "annual" ? item.amountMinor / 12 : item.amountMinor), 0));

  function localDate(date = new Date()): string {
    return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
  }
  function blankSubscription(): Subscription {
    return { id: "", name: "", amountMinor: 0, cadence: "monthly", nextRenewal: localDate(), category: "Entertainment", note: "", active: true };
  }
  function money(minor: number): string {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: tracker.current.currency }).format(minor / 100);
  }
  function dateLabel(value: string): string {
    if (!value) return "No date";
    return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(new Date(`${value}T12:00:00`));
  }
  function renewalState(value: string): "overdue" | "soon" | "normal" {
    const today = localDate();
    if (value < today) return "overdue";
    const soon = new Date(`${today}T12:00:00`); soon.setDate(soon.getDate() + 30);
    return value <= localDate(soon) ? "soon" : "normal";
  }
  function beginAdd(): void {
    editingId = null;
    draft = blankSubscription();
    showDialog = true;
  }
  function beginEdit(item: Subscription): void {
    editingId = item.id;
    draft = { ...item };
    showDialog = true;
  }
  function closeDialog(): void { showDialog = false; }
  function save(): void {
    const name = draft.name.trim();
    const amountMinor = Math.round(Number(draft.amountMinor));
    if (!name || !Number.isFinite(amountMinor) || amountMinor <= 0 || !draft.nextRenewal) return;
    const item = { ...draft, id: editingId ?? crypto.randomUUID(), name, amountMinor, note: draft.note.trim() };
    if (editingId) tracker.current.subscriptions = tracker.current.subscriptions.map((subscription) => subscription.id === editingId ? item : subscription);
    else tracker.current.subscriptions.push(item);
    closeDialog();
  }
  function toggle(item: Subscription): void {
    item.active = !item.active;
  }
  function remove(): void {
    if (!editingId) return;
    tracker.current.subscriptions = tracker.current.subscriptions.filter((item) => item.id !== editingId);
    closeDialog();
  }
</script>

<main class="tracker-canvas">
  <article class="ledger" aria-label="Subscription tracker">
    <header class="masthead">
      <div>
        <p>Recurring costs</p>
        <h1>Subscriptions</h1>
      </div>
      <label class="currency-field"><span>Currency</span><select aria-label="Document currency" bind:value={tracker.current.currency}>{#each currencies as currency}<option value={currency}>{currency}</option>{/each}</select></label>
    </header>

    <section class="totals" aria-label="Active subscription totals">
      <div><span>Monthly pace</span><strong>{money(monthlyMinor)}</strong></div>
      <div><span>Yearly pace</span><b>{money(monthlyMinor * 12)}</b></div>
      <div class="total-note"><CalendarDays /><span>{activeSubscriptions.length} active service{activeSubscriptions.length === 1 ? "" : "s"}</span></div>
    </section>

    <section class="services" aria-labelledby="services-title">
      <div class="list-head">
        <Tabs.Root value={view} onValueChange={(v) => { if (v === "active" || v === "all") view = v; }}>
          <Tabs.List class="view-tabs" data-slop-export="hide" aria-label="Subscription view">
            <Tabs.Trigger value="active" class="view-tab">Active</Tabs.Trigger>
            <Tabs.Trigger value="all" class="view-tab">All</Tabs.Trigger>
          </Tabs.List>
        </Tabs.Root>
        <h2 id="services-title">{view === "active" ? "Active services" : "All services"}</h2>
        <button class="add-service" data-slop-export="hide" onclick={beginAdd}><Plus /> Add service</button>
      </div>

      {#if visibleSubscriptions.length}
        <ol class="service-list">
          {#each visibleSubscriptions as item (item.id)}
            <li class:paused={!item.active}>
              <button class="service-copy" onclick={() => beginEdit(item)} aria-label={`Edit ${item.name}`}>
                <span class="service-mark">{item.name.slice(0, 1).toUpperCase()}</span>
                <span class="service-name"><strong>{item.name}</strong><small>{item.category}{item.note ? ` · ${item.note}` : ""}</small></span>
              </button>
              <time data-state={renewalState(item.nextRenewal)}><span>Renews</span><b>{dateLabel(item.nextRenewal)}</b></time>
              <output><strong>{money(item.amountMinor)}</strong><small>/{item.cadence === "annual" ? "yr" : "mo"}</small></output>
              <button class="toggle" data-slop-export="hide" onclick={() => toggle(item)} aria-label={item.active ? `Pause ${item.name}` : `Resume ${item.name}`}>
                {#if item.active}<Pause />{:else}<Play />{/if}
              </button>
            </li>
          {/each}
        </ol>
      {:else}
        <div class="empty-state">
          <div><CalendarDays /></div>
          <strong>No recurring costs yet.</strong>
          <p>Add a service you want to keep an eye on. Its next renewal will appear here.</p>
          <button data-slop-export="hide" onclick={beginAdd}><Plus /> Add your first service</button>
        </div>
      {/if}
    </section>

    <footer><span>{activeSubscriptions.length} active service{activeSubscriptions.length === 1 ? "" : "s"}</span><span>Tap a service to edit</span></footer>
    {#if tracker.error}<p class="save-error">Changes could not be saved. {tracker.error}</p>{/if}
  </article>

  <Dialog.Root bind:open={showDialog}>
    <Dialog.Portal>
      <Dialog.Overlay class="editor-backdrop" data-slop-export="hide" />
      <Dialog.Content class="editor" aria-label={editingId ? "Edit subscription" : "Add subscription"} data-slop-export="hide">
        <form onsubmit={(event) => { event.preventDefault(); save(); }}>
          <header>
            <div>
              <p>{editingId ? "Edit service" : "New service"}</p>
              <Dialog.Title><h2>{editingId ? "Keep the ledger current" : "Track a recurring cost"}</h2></Dialog.Title>
            </div>
            <Dialog.Close class="dialog-close" type="button" aria-label="Close"><X /></Dialog.Close>
          </header>
          <label>Name<input required placeholder="Service name" bind:value={draft.name} /></label>
          <div class="form-grid"><label>Amount<input required type="number" min="0.01" step="0.01" value={draft.amountMinor ? (draft.amountMinor / 100).toFixed(2) : ""} oninput={(event) => draft.amountMinor = Math.round(Number(event.currentTarget.value) * 100)} /></label><label>Renews<input required type="date" bind:value={draft.nextRenewal} /></label></div>
          <div class="form-grid"><label>Billing<select bind:value={draft.cadence}><option value="monthly">Monthly</option><option value="annual">Annual</option></select></label><label>Category<select bind:value={draft.category}>{#each categories as category}<option value={category}>{category}</option>{/each}</select></label></div>
          <label>Note <span class="optional">optional</span><input placeholder="Plan or detail" bind:value={draft.note} /></label>
          <footer>{#if editingId}<button class="delete" type="button" onclick={remove}><Trash2 /> Delete</button>{/if}<span></span><button class="cancel" type="button" onclick={closeDialog}>Cancel</button><button class="save" type="submit">{editingId ? "Save changes" : "Add service"}</button></footer>
        </form>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>
</main>

{#if capture.isRenderer()}<Icon />{/if}
