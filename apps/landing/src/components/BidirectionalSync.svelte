<script lang="ts">
  import { onDestroy } from "svelte";

  type Item = { title: string; done: boolean };
  type Direction = "idle" | "ui" | "disk";

  const initialItems: Item[] = [
    { title: "Draft proposal", done: true },
    { title: "Send invoice", done: true },
    { title: "Book train", done: false },
  ];

  let items = $state<Item[]>(initialItems.map((item) => ({ ...item })));
  let jsonDraft = $state(JSON.stringify({ items: initialItems }, null, 2));
  let jsonValid = $state(true);
  let direction = $state<Direction>("idle");
  let settleTimer: ReturnType<typeof setTimeout> | undefined;

  const completed = $derived(items.filter((item) => item.done).length);

  function showDirection(next: Exclude<Direction, "idle">): void {
    direction = next;
    if (settleTimer) clearTimeout(settleTimer);
    settleTimer = setTimeout(() => {
      direction = "idle";
      settleTimer = undefined;
    }, 1600);
  }

  function updateFromUI(index: number, done: boolean): void {
    items = items.map((item, itemIndex) => itemIndex === index ? { ...item, done } : item);
    jsonDraft = JSON.stringify({ items }, null, 2);
    jsonValid = true;
    showDirection("ui");
  }

  function updateFromDisk(value: string): void {
    jsonDraft = value;
    try {
      const parsed: unknown = JSON.parse(value);
      if (!parsed || typeof parsed !== "object" || !("items" in parsed) || !Array.isArray(parsed.items)) throw new Error("items must be an array");
      const next = parsed.items.map((item: unknown) => {
        if (!item || typeof item !== "object" || !("title" in item) || !("done" in item) || typeof item.title !== "string" || typeof item.done !== "boolean") throw new Error("invalid item");
        return { title: item.title, done: item.done };
      });
      if (next.length === 0) throw new Error("items cannot be empty");
      items = next;
      jsonValid = true;
      showDirection("disk");
    } catch {
      jsonValid = false;
    }
  }

  onDestroy(() => {
    if (settleTimer) clearTimeout(settleTimer);
  });
</script>

<div class="sync-demo" data-direction={direction}>
  <section class="sync-window" aria-label="Editable checklist interface">
    <div class="window-bar"><i></i><i></i><i></i><span>Today.slop</span></div>
    <div class="checklist">
      {#each items as item, index}
        <label>
          <input type="checkbox" checked={item.done} onchange={(event) => updateFromUI(index, event.currentTarget.checked)} />
          <span>{item.title}</span>
        </label>
      {/each}
    </div>
    <p><strong>{completed}</strong> of {items.length} done <small>{direction === "disk" ? "Updated from disk" : direction === "ui" ? "Written to disk" : "Try a checkbox"}</small></p>
  </section>

  <div class="sync-arrows" aria-hidden="true">
    <span class:active={direction === "ui"}>UI → disk</span>
    <b>⇄</b>
    <span class:active={direction === "disk"}>disk → UI</span>
  </div>

  <section class="sync-code" aria-label="Editable JSON data">
    <header><span class="status-dot" class:invalid={!jsonValid}></span><code>stores/data.json</code><small>{jsonValid ? direction === "ui" ? "updated" : "local" : "keep typing…"}</small></header>
    <label for="sync-json">Edit the JSON</label>
    <textarea id="sync-json" value={jsonDraft} oninput={(event) => updateFromDisk(event.currentTarget.value)} spellcheck="false" aria-invalid={!jsonValid}></textarea>
  </section>
</div>

<style>
  :global(*) { box-sizing: border-box; }
  .sync-demo { width: 100%; display: grid; gap: 22px; align-items: center; }
  .sync-window { overflow: hidden; border: 1px solid oklch(80% .025 320 / .24); border-radius: 17px; color: oklch(20% .018 255); background: oklch(97% .018 85); box-shadow: 0 38px 90px oklch(8% .04 320 / .3); transform: rotate(-1deg); }
  .window-bar { min-height: 49px; padding: 0 15px; display: flex; align-items: center; gap: 6px; border-bottom: 1px solid oklch(82% .025 80); }
  .window-bar i { width: 9px; height: 9px; border-radius: 50%; background: oklch(70% .18 35); }
  .window-bar i:nth-child(2) { background: oklch(87% .16 91); }
  .window-bar i:nth-child(3) { background: oklch(68% .13 145); }
  .window-bar span { margin-left: 8px; font-size: .7rem; font-weight: 700; }
  .checklist label { min-height: 56px; padding: 0 19px; display: flex; align-items: center; gap: 11px; border-bottom: 1px solid oklch(86% .025 80); font-size: .78rem; cursor: pointer; }
  .checklist input { width: 16px; height: 16px; accent-color: oklch(50% .14 145); cursor: pointer; }
  .sync-window > p { margin: 0; padding: 14px 19px; display: flex; align-items: center; gap: 4px; color: oklch(46% .02 255); font-size: .68rem; }
  .sync-window > p strong { color: oklch(20% .018 255); }
  .sync-window > p small { margin-left: auto; color: oklch(43% .09 145); font-size: .58rem; font-weight: 700; }
  .sync-arrows { display: flex; align-items: center; justify-content: center; gap: 13px; color: oklch(72% .04 320); }
  .sync-arrows b { width: 44px; height: 44px; display: grid; place-items: center; border: 1px solid oklch(80% .035 320 / .22); border-radius: 50%; color: oklch(22% .055 320); background: oklch(84% .1 145); font-size: 1.3rem; transition: transform 240ms cubic-bezier(.22,1,.36,1), background-color 240ms cubic-bezier(.22,1,.36,1); }
  .sync-arrows span { font-size: .62rem; font-weight: 700; letter-spacing: .07em; text-transform: uppercase; transition: color 180ms cubic-bezier(.22,1,.36,1); }
  .sync-arrows span.active { color: oklch(87% .12 145); }
  .sync-demo[data-direction="ui"] .sync-arrows b { transform: rotate(16deg) scale(1.08); }
  .sync-demo[data-direction="disk"] .sync-arrows b { transform: rotate(-16deg) scale(1.08); }
  .sync-code { position: relative; overflow: hidden; border: 1px solid oklch(80% .025 320 / .2); border-radius: 15px; background: oklch(16% .04 320); box-shadow: 0 22px 55px oklch(7% .03 320 / .28); transform: rotate(.8deg); }
  .sync-code header { min-height: 48px; padding: 0 16px; display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 9px; border-bottom: 1px solid oklch(82% .03 320 / .12); }
  .status-dot { width: 7px; height: 7px; border-radius: 50%; background: oklch(72% .13 145); }
  .status-dot.invalid { background: oklch(70% .16 30); }
  .sync-code header code { color: oklch(88% .025 320); font-size: .68rem; }
  .sync-code header small { color: oklch(68% .04 320); font-size: .6rem; }
  .sync-code > label { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
  textarea { width: 100%; min-height: 248px; margin: 0; padding: 22px 18px 26px; resize: vertical; border: 0; outline: 0; color: oklch(83% .045 96); background: transparent; font: .7rem/1.7 "SFMono-Regular", "Cascadia Code", ui-monospace, monospace; tab-size: 2; }
  textarea:focus-visible { box-shadow: inset 0 0 0 2px oklch(84% .1 145); }
  textarea[aria-invalid="true"] { box-shadow: inset 0 0 0 2px oklch(70% .16 30); }
  @media (min-width: 620px) {
    .sync-demo { grid-template-columns: 1fr auto 1.08fr; gap: 14px; }
    .sync-arrows { flex-direction: column; }
  }
  @media (prefers-reduced-motion: reduce) { .sync-arrows b, .sync-arrows span { transition: none; } }
</style>
