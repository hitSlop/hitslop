<script lang="ts">
  import { ready } from "@hitslop/runtime";
  import { jsonStore, IconTarget, ExportTarget } from "@hitslop/svelte";
  import { onDestroy } from "svelte";
  import { Button, Dialog, Select, Tabs } from "bits-ui";
  import CalendarDays from "@lucide/svelte/icons/calendar-days";
  import Check from "@lucide/svelte/icons/check";
  import ChevronDown from "@lucide/svelte/icons/chevron-down";
  import Pause from "@lucide/svelte/icons/pause";
  import Play from "@lucide/svelte/icons/play";
  import Plus from "@lucide/svelte/icons/plus";
  import Trash2 from "@lucide/svelte/icons/trash-2";
  import X from "@lucide/svelte/icons/x";
  import trackerSchema from "../schema";
  import type { Subscription } from "../schema";
  import Icon from "./Icon.svelte";
  import Export from "./Export.svelte";
  import CategoryMark from "./CategoryMark.svelte";
  import Repeat2 from "@lucide/svelte/icons/repeat-2";
  import * as s from "./styles.css";

  const currencies = ["USD", "CAD", "EUR", "GBP", "AUD", "JPY"].map(value => ({ value, label: value }));
  const cadences = [
    { value: "monthly", label: "Monthly" },
    { value: "annual", label: "Annual" },
  ] as const;
  const categories = ["Entertainment", "Work", "Home", "Health", "Other"].map(value => ({ value, label: value }));

  function localDate(date = new Date()): string {
    return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
  }
  function daysFromNow(days: number): string {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return localDate(date);
  }

  const tracker = jsonStore({ schema: trackerSchema, initial: {
    currency: "USD",
    subscriptions: [
      { id: "netflix", name: "Netflix", amount: 15.49, cadence: "monthly", nextRenewal: daysFromNow(12), category: "Entertainment", note: "Standard", active: true },
      { id: "icloud", name: "iCloud+", amount: 2.99, cadence: "monthly", nextRenewal: daysFromNow(21), category: "Home", note: "200 GB", active: true },
      { id: "adobe", name: "Adobe Creative Cloud", amount: 54.99, cadence: "monthly", nextRenewal: daysFromNow(6), category: "Work", note: "Photography", active: true },
      { id: "gym", name: "Planet Fitness", amount: 24.99, cadence: "monthly", nextRenewal: daysFromNow(-3), category: "Health", note: "", active: true },
      { id: "domain", name: "Namecheap domain", amount: 13.98, cadence: "annual", nextRenewal: daysFromNow(84), category: "Work", note: "hitslop.com", active: true },
      { id: "times", name: "New York Times", amount: 17, cadence: "monthly", nextRenewal: daysFromNow(40), category: "Entertainment", note: "Paused for summer", active: false },
    ],
  } });
  $effect(() => { if (tracker.isReady) ready(); });
  onDestroy(() => tracker.destroy());

  let view = $state<"active" | "all">("active");
  let showDialog = $state(false);
  let editingId = $state<string | null>(null);
  let draft = $state<Subscription>(blankSubscription());

  const activeSubscriptions = $derived(tracker.current.subscriptions.filter(item => item.active));
  const visibleSubscriptions = $derived(
    [...tracker.current.subscriptions]
      .filter(item => view === "all" || item.active)
      .sort((a, b) => Number(b.active) - Number(a.active) || a.nextRenewal.localeCompare(b.nextRenewal) || a.name.localeCompare(b.name)),
  );
  const monthlyPace = $derived(activeSubscriptions.reduce((total, item) => total + monthlyAmount(item), 0));

  function blankSubscription(): Subscription {
    return { id: "", name: "", amount: 0, cadence: "monthly", nextRenewal: localDate(), category: "Entertainment", note: "", active: true };
  }
  function monthlyAmount(item: Subscription): number {
    return item.cadence === "annual" ? item.amount / 12 : item.amount;
  }
  function money(value: number): string {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: tracker.current.currency }).format(value);
  }
  function dateLabel(value: string): string {
    if (!value || Number.isNaN(new Date(`${value}T12:00:00`).getTime())) return "No date";
    return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(new Date(`${value}T12:00:00`));
  }
  function renewalState(value: string): "overdue" | "soon" | "normal" {
    if (!value || Number.isNaN(new Date(`${value}T12:00:00`).getTime())) return "normal";
    const today = localDate();
    if (value < today) return "overdue";
    const soon = new Date(`${today}T12:00:00`);
    soon.setDate(soon.getDate() + 30);
    return value <= localDate(soon) ? "soon" : "normal";
  }
  function cadenceLabel(cadence: string): string {
    return cadence === "annual" ? "yr" : "mo";
  }
  function isCadence(value: string): value is "monthly" | "annual" {
    return cadences.some(item => item.value === value);
  }
  function isCategory(value: string): boolean {
    return categories.some(item => item.value === value);
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
  function closeDialog(): void {
    showDialog = false;
  }
  function save(): void {
    const name = draft.name.trim();
    const amount = Number(draft.amount);
    if (!name || !Number.isFinite(amount) || amount <= 0 || !draft.nextRenewal) return;
    const item = { ...draft, id: editingId ?? crypto.randomUUID(), name, amount, note: draft.note.trim() };
    if (editingId) tracker.current.subscriptions = tracker.current.subscriptions.map(subscription => subscription.id === editingId ? item : subscription);
    else tracker.current.subscriptions.push(item);
    closeDialog();
  }
  function toggle(item: Subscription): void {
    item.active = !item.active;
  }
  function remove(): void {
    if (!editingId) return;
    tracker.current.subscriptions = tracker.current.subscriptions.filter(item => item.id !== editingId);
    closeDialog();
  }
</script>

<main class={s.canvas} data-slop-selection="none" aria-busy={tracker.isLoading}>
  <article class={s.ledger} aria-label="Subscription ledger" inert={!tracker.isReady || tracker.isLoading}>
    <header class={s.masthead}>
      <div>

        <h1>Subscriptions<span class={s.headingLoop} aria-hidden="true"><Repeat2 size={24} /></span></h1>
      </div>
      <div class={s.currencyField}>
        <span>Currency</span>
        <Select.Root type="single" value={tracker.current.currency} items={currencies} onValueChange={value => { if (currencies.some(item => item.value === value)) tracker.current.currency = value; }}>
          <Select.Trigger class={s.currencyTrigger} aria-label="Document currency" title="Changes the currency label; amounts are not converted">
            <Select.Value placeholder="Currency" />
            <ChevronDown size={12} data-slop-export="hide" strokeWidth={1.8} />
          </Select.Trigger>
          <Select.Portal>
            <Select.Content class={s.selectContent} sideOffset={6}>
              <Select.Viewport>
                {#each currencies as item (item.value)}
                  <Select.Item value={item.value} label={item.label}>
                    {#snippet children({ selected })}{item.label}{#if selected}<Check size={13} strokeWidth={1.8} />{/if}{/snippet}
                  </Select.Item>
                {/each}
              </Select.Viewport>
            </Select.Content>
          </Select.Portal>
        </Select.Root>
      </div>
    </header>

    <section class={s.totals} aria-label="Active subscription totals">
      <div>
        <span>Monthly total</span>
        <strong>{money(monthlyPace)}</strong>
      </div>
      <div>
        <span>Yearly estimate</span>
        <b>{money(monthlyPace * 12)}</b>
      </div>
      <div class={s.totalNote}>
        <CalendarDays size={15} strokeWidth={1.8} />
        <span>{activeSubscriptions.length} active service{activeSubscriptions.length === 1 ? "" : "s"}</span>
      </div>
    </section>

    <section class={s.services} aria-labelledby="services-title">
      <div class={s.listHead}>
        <Tabs.Root value={view} onValueChange={value => { if (value === "active" || value === "all") view = value; }}>
          <Tabs.List class={s.viewTabs} data-slop-export="hide" aria-label="Subscription view">
            <Tabs.Trigger value="active" class={s.viewTab}>Active</Tabs.Trigger>
            <Tabs.Trigger value="all" class={s.viewTab}>All</Tabs.Trigger>
          </Tabs.List>
        </Tabs.Root>
        <h2 id="services-title">{view === "active" ? "Active services" : "All services"}</h2>
        <Button.Root class={s.add} data-slop-export="hide" onclick={beginAdd}><Plus size={14} strokeWidth={1.8} /> Add service</Button.Root>
      </div>

      {#if visibleSubscriptions.length}
        <ol class={s.serviceList}>
          {#each visibleSubscriptions as item (item.id)}
            <li class={s.row} data-paused={!item.active}>
              <button class={s.serviceCopy} onclick={() => beginEdit(item)} aria-label="Edit {item.name}">
                <CategoryMark category={item.category} /><span class={s.serviceText}><strong>{item.name}</strong>
                <small>{item.category}{item.note ? ` · ${item.note}` : ""}</small></span>
              </button>
              <time data-state={item.active ? renewalState(item.nextRenewal) : "normal"}>
                <span>{!item.active ? "Paused" : renewalState(item.nextRenewal) === "overdue" ? "Date passed" : "Renews"}</span>
                <b>{dateLabel(item.nextRenewal)}</b>
              </time>
              <output>
                <strong>{money(item.amount)}</strong>
                <small>/{cadenceLabel(item.cadence)}</small>
              </output>
              <button class={s.toggle} data-slop-export="hide" onclick={() => toggle(item)} title="Changes tracking only, not your subscription" aria-label={item.active ? `Pause tracking ${item.name}` : `Resume tracking ${item.name}`}>
                {#if item.active}<Pause size={12} strokeWidth={1.8} />{:else}<Play size={12} strokeWidth={1.8} />{/if}
              </button>
            </li>
          {/each}
        </ol>
      {:else}
        <div class={s.empty}>
          <CalendarDays size={18} strokeWidth={1.7} />
          <strong>{view === "active" && tracker.current.subscriptions.length ? "Everything is paused." : "Your subscriptions, in one place."}</strong>
          <p>{view === "active" && tracker.current.subscriptions.length ? "Switch to All to resume tracking a service." : "Add your first service to see its cost and next renewal."}</p>
          <Button.Root class={s.add} data-slop-export="hide" onclick={beginAdd}><Plus size={14} strokeWidth={1.8} /> Add your first service</Button.Root>
        </div>
      {/if}
    </section>

    <footer class={s.footer}>
      <span>{activeSubscriptions.length} active service{activeSubscriptions.length === 1 ? "" : "s"}</span>
      <span>Tracking only · billing stays with each service</span>
    </footer>

  </article>
  {#if tracker.error}<p class={s.saveError} role="alert">{tracker.isReady ? "Changes could not be saved." : "Subscriptions could not be loaded."} <button onclick={() => { if (tracker.isReady) void tracker.flush().catch(() => undefined); else void tracker.reload(); }}>Try again</button></p>{/if}
</main>

<Dialog.Root bind:open={showDialog}>
  <Dialog.Portal>
    <Dialog.Overlay class={s.editorBackdrop} data-slop-export="hide" />
    <Dialog.Content class={s.editor} aria-label={editingId ? "Edit subscription" : "Add subscription"} data-slop-export="hide">
      <form onsubmit={event => { event.preventDefault(); save(); }}>
        <header>
          <div>

            <Dialog.Title>{editingId ? "Edit subscription" : "Track a recurring cost"}</Dialog.Title>
          </div>
          <Dialog.Close class={s.dialogClose} type="button" aria-label="Close"><X size={14} strokeWidth={1.8} /></Dialog.Close>
        </header>
        <label>Name<input required placeholder="Service name" bind:value={draft.name} /></label>
        <div class={s.formGrid}>
          <label>Amount<input required type="number" min="0.01" step="0.01" value={draft.amount ? draft.amount.toFixed(2) : ""} oninput={event => { draft.amount = Number(event.currentTarget.value); }} /></label>
          <label>Renews<input required type="date" bind:value={draft.nextRenewal} /></label>
        </div>
        <div class={s.formGrid}>
          <label>
            Billing
            <Select.Root type="single" value={draft.cadence} items={[...cadences]} onValueChange={value => { if (isCadence(value)) draft.cadence = value; }}>
              <Select.Trigger class={s.fieldTrigger} aria-label="Billing cadence">
                <Select.Value placeholder="Cadence" />
                <ChevronDown size={13} strokeWidth={1.8} />
              </Select.Trigger>
              <Select.Portal>
                <Select.Content class={s.selectContent} sideOffset={6}>
                  <Select.Viewport>
                    {#each cadences as item (item.value)}
                      <Select.Item value={item.value} label={item.label}>
                        {#snippet children({ selected })}{item.label}{#if selected}<Check size={13} strokeWidth={1.8} />{/if}{/snippet}
                      </Select.Item>
                    {/each}
                  </Select.Viewport>
                </Select.Content>
              </Select.Portal>
            </Select.Root>
          </label>
          <label>
            Category
            <Select.Root type="single" value={draft.category} items={categories} onValueChange={value => { if (isCategory(value)) draft.category = value; }}>
              <Select.Trigger class={s.fieldTrigger} aria-label="Service category">
                <Select.Value placeholder="Category" />
                <ChevronDown size={13} strokeWidth={1.8} />
              </Select.Trigger>
              <Select.Portal>
                <Select.Content class={s.selectContent} sideOffset={6}>
                  <Select.Viewport>
                    {#each categories as item (item.value)}
                      <Select.Item value={item.value} label={item.label}>
                        {#snippet children({ selected })}{item.label}{#if selected}<Check size={13} strokeWidth={1.8} />{/if}{/snippet}
                      </Select.Item>
                    {/each}
                  </Select.Viewport>
                </Select.Content>
              </Select.Portal>
            </Select.Root>
          </label>
        </div>
        <label>Note <span class={s.optional}>optional</span><input placeholder="Plan or detail" bind:value={draft.note} /></label>
        <footer>
          {#if editingId}<button class={s.deleteBtn} type="button" onclick={remove}><Trash2 size={12} strokeWidth={1.8} /> Delete</button>{/if}
          <span></span>
          <button class={s.cancel} type="button" onclick={closeDialog}>Cancel</button>
          <button class={s.save} type="submit">{editingId ? "Save changes" : "Add service"}</button>
        </footer>
      </form>
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>

<IconTarget><Icon /></IconTarget>
<ExportTarget><Export data={tracker.current} view={view} /></ExportTarget>
