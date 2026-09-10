<script lang="ts">
  import { capture, ready } from "@hitslop/runtime";
  import { jsonStore, IconTarget, ExportTarget } from "@hitslop/svelte";
  import { onDestroy, onMount, tick, untrack } from "svelte";
  import { Tween, prefersReducedMotion } from "svelte/motion";
  import { cubicOut } from "svelte/easing";
  import { Progress, Button } from "bits-ui";
  import Plus from "@lucide/svelte/icons/plus";
  import Trash2 from "@lucide/svelte/icons/trash-2";
  import ArrowRight from "@lucide/svelte/icons/arrow-right";
  import budgetSchema from "../schema";
  import type { PersonalBudget } from "../schema";
  import Icon from "./Icon.svelte";
  import Export from "./Export.svelte";
  import * as s from "./styles.css";

  type Category = PersonalBudget["categories"][number];
  const FILL_MS = 350;

  const doc = jsonStore({ schema: budgetSchema, initial: {
    month: "September 2026",
    income: 5400,
    savings: 1200,
    categories: [
      { id: "1", name: "Housing", allocated: 1600, spent: 1600 },
      { id: "2", name: "Food & Dining", allocated: 800, spent: 542 },
      { id: "3", name: "Transport", allocated: 300, spent: 212 },
      { id: "4", name: "Utilities", allocated: 350, spent: 315 },
      { id: "5", name: "Health", allocated: 200, spent: 120 },
      { id: "6", name: "Other & Leisure", allocated: 400, spent: 270 },
    ],
  } });

  let selectedCategoryId = $state("2");
  let calcDisplay = $state("0");
  let calcPrev = $state<number | null>(null);
  let calcOp = $state<string | null>(null);
  let waitingForOperand = $state(false);
  let calcMemory = $state(0);
  let calcHistory = $state("");

  const totalSpent = $derived(doc.current.categories.reduce((sum, cat) => sum + money(cat.spent), 0));
  const remaining = $derived(doc.current.income - totalSpent);
  const remainingRatio = $derived(doc.current.income > 0 ? clamp(Math.max(0, remaining) / doc.current.income * 100, 0, 100) : 0);
  const selectedCategory = $derived(doc.current.categories.find(cat => cat.id === selectedCategoryId));
  const overspent = $derived(remaining < 0);
  const routeAmount = $derived(parseFloat(calcDisplay) || 0);

  const remainingMotion = new Tween(untrack(() => remainingRatio), { duration: FILL_MS, easing: cubicOut });
  const categoryMotion = new Map<string, Tween<number>>();
  let initialized = false;

  $effect(() => { if (doc.isReady) ready(); });
  $effect.pre(() => {
    for (const cat of doc.current.categories) fillTween(cat);
  });
  $effect(() => {
    const instant = !initialized || !doc.isReady || prefersReducedMotion.current;
    const duration = instant ? 0 : FILL_MS;
    void remainingMotion.set(remainingRatio, { duration, delay: 0 });
    for (const cat of doc.current.categories) {
      void fillTween(cat).set(categoryPercent(cat), { duration, delay: 0 });
    }
    initialized = doc.isReady;
  });

  onMount(() => capture.onPrepare(async () => {
    await remainingMotion.set(remainingRatio, { duration: 0, delay: 0 });
    await Promise.all(doc.current.categories.map(cat => fillTween(cat).set(categoryPercent(cat), { duration: 0, delay: 0 })));
    await tick();
  }));

  onDestroy(() => {
    void remainingMotion.set(remainingMotion.target, { duration: 0, delay: 0 });
    for (const tween of categoryMotion.values()) void tween.set(tween.target, { duration: 0, delay: 0 });
    doc.destroy();
  });

  function money(value: number): number {
    return Number.isFinite(value) ? value : 0;
  }
  function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
  }
  function roundCents(value: number): number {
    return Math.round(value * 100) / 100;
  }
  function categoryPercent(cat: Category): number {
    const allocated = money(cat.allocated);
    const spent = money(cat.spent);
    if (allocated <= 0) return spent > 0 ? 100 : 0;
    return clamp((spent / allocated) * 100, 0, 100);
  }
  function fillTween(cat: Category): Tween<number> {
    let tween = categoryMotion.get(cat.id);
    if (!tween) {
      tween = new Tween(untrack(() => categoryPercent(cat)), { duration: FILL_MS, easing: cubicOut });
      categoryMotion.set(cat.id, tween);
    }
    return tween;
  }
  function fillWidth(cat: Category): number {
    return fillTween(cat).current;
  }
  function formatCurrency(num: number): string {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(num);
  }
  function parseAmount(value: string): number | null {
    if (value.trim() === "") return null;
    const next = Number(value);
    if (!Number.isFinite(next) || next < 0) return null;
    return roundCents(next);
  }
  function addCategory() {
    if (doc.isLoading) return;
    const id = crypto.randomUUID();
    doc.current.categories.push({ id, name: "New Category", allocated: 200, spent: 0 });
    selectedCategoryId = id;
  }
  function removeCategory(id: string) {
    doc.current.categories = doc.current.categories.filter(cat => cat.id !== id);
    categoryMotion.delete(id);
    if (selectedCategoryId === id) selectedCategoryId = doc.current.categories[0]?.id ?? "";
  }
  function inputDigit(digit: string) {
    if (waitingForOperand) {
      calcDisplay = digit;
      waitingForOperand = false;
    } else {
      calcDisplay = calcDisplay === "0" ? digit : calcDisplay + digit;
    }
  }
  function inputDot() {
    if (waitingForOperand) {
      calcDisplay = "0.";
      waitingForOperand = false;
      return;
    }
    if (!calcDisplay.includes(".")) calcDisplay += ".";
  }
  function clearCalc() {
    calcDisplay = "0";
    calcPrev = null;
    calcOp = null;
    waitingForOperand = false;
    calcHistory = "";
  }
  function compute(first: number, second: number, op: string): number {
    switch (op) {
      case "+": return first + second;
      case "-": return first - second;
      case "*": return first * second;
      case "/": return second !== 0 ? first / second : 0;
      default: return second;
    }
  }
  function handleOp(nextOp: string) {
    const inputValue = parseFloat(calcDisplay);
    if (calcPrev === null) {
      calcPrev = inputValue;
    } else if (calcOp && !waitingForOperand) {
      const result = compute(calcPrev || 0, inputValue, calcOp);
      calcDisplay = String(result);
      calcPrev = result;
    }
    waitingForOperand = true;
    calcOp = nextOp;
    calcHistory = `${calcPrev} ${nextOp}`;
  }
  function handleEquals() {
    const inputValue = parseFloat(calcDisplay);
    if (calcOp && calcPrev !== null) {
      const result = compute(calcPrev, inputValue, calcOp);
      calcHistory = `${calcPrev} ${calcOp} ${inputValue} =`;
      calcDisplay = String(roundCents(result));
      calcPrev = null;
      calcOp = null;
      waitingForOperand = true;
    }
  }
  function handleMemory(action: "MC" | "MR" | "M+" | "M-") {
    const val = parseFloat(calcDisplay) || 0;
    if (action === "MC") calcMemory = 0;
    if (action === "MR") {
      calcDisplay = String(calcMemory);
      waitingForOperand = true;
    }
    if (action === "M+") calcMemory += val;
    if (action === "M-") calcMemory -= val;
  }
  function routeToCategory() {
    const amount = parseFloat(calcDisplay);
    if (doc.isLoading || Number.isNaN(amount) || amount <= 0 || !selectedCategory) return;
    selectedCategory.spent = roundCents(money(selectedCategory.spent) + amount);
    calcHistory = `Logged +${formatCurrency(amount)} to ${selectedCategory.name}`;
  }
  function handleKeydown(event: KeyboardEvent) {
    const tag = (event.target as HTMLElement)?.tagName?.toLowerCase();
    if (tag === "input" || tag === "textarea") return;
    if (event.key >= "0" && event.key <= "9") inputDigit(event.key);
    else if (event.key === ".") inputDot();
    else if (["+", "-", "*", "/"].includes(event.key)) handleOp(event.key);
    else if (event.key === "Enter" || event.key === "=") {
      event.preventDefault();
      handleEquals();
    } else if (event.key === "Escape" || event.key === "c" || event.key === "C") clearCalc();
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<main class={s.canvas} data-slop-selection="none" aria-busy={doc.isLoading} aria-label="Personal budget">
  <div class={s.chassis} inert={!doc.isReady || doc.isLoading}>
    <section class={s.ledger} aria-label="Monthly budget ledger">
      <div class={s.ledgerHead}>
        <input class={s.month} aria-label="Budget month" bind:value={doc.current.month} />
        <span class={s.pill}>Ledger</span>
      </div>

      <div class={s.hero} data-over={overspent}>
        <span class={s.heroLabel}>Remaining funds</span>
        <span class={s.heroValue} aria-live="polite">{formatCurrency(remaining)}</span>
        <span class={s.heroSub}>{overspent ? "over monthly income" : "left of monthly income"}</span>
        <Progress.Root value={remainingRatio} max={100} class={s.remainingTrack} aria-label="Remaining funds of monthly income">
          <div class={s.remainingFill} style:transform={`scaleX(${remainingMotion.current / 100})`} aria-hidden="true"></div>
        </Progress.Root>
      </div>

      <div class={s.stats}>
        <label class={s.chip}>
          <span class={s.chipLabel}>Income</span>
          <input class={s.chipValue} type="number" min="0" step="0.01" aria-label="Monthly income" value={doc.current.income} oninput={event => { const next = parseAmount(event.currentTarget.value); if (next !== null) doc.current.income = next; }} />
        </label>
        <div class={s.chip}>
          <span class={s.chipLabel}>Expenses</span>
          <span class={s.chipValue}>{formatCurrency(totalSpent)}</span>
        </div>
        <label class={s.chip}>
          <span class={s.chipLabel}>Savings</span>
          <input class={s.chipValue} type="number" min="0" step="0.01" aria-label="Savings target" value={doc.current.savings} oninput={event => { const next = parseAmount(event.currentTarget.value); if (next !== null) doc.current.savings = next; }} />
        </label>
      </div>

      <div class={s.categories}>
        <div class={s.catHead}>
          <span class={s.catTitle}>Categories</span>
          <Button.Root type="button" class={s.iconBtn} data-slop-export="hide" aria-label="Add spending category" onclick={addCategory} disabled={doc.isLoading}>
            <Plus size={14} />
          </Button.Root>
        </div>
        <ul class={s.catList}>
          {#each doc.current.categories as cat (cat.id)}
            {@const percent = categoryPercent(cat)}
            {@const isOver = money(cat.spent) > money(cat.allocated)}
            <li class={s.catRow} data-selected={selectedCategoryId === cat.id}>
              <div class={s.catMeta}>
                <button type="button" class={s.catSelect} data-active={selectedCategoryId === cat.id} aria-label="Select {cat.name} for calculator" aria-pressed={selectedCategoryId === cat.id} onclick={() => (selectedCategoryId = cat.id)}>
                  <span class={s.catDot}></span>
                </button>
                <input class={s.catName} aria-label="Category name" bind:value={cat.name} onfocus={() => (selectedCategoryId = cat.id)} />
                <div class={s.catFigures}>
                  <span class={s.spent}>{formatCurrency(money(cat.spent))}</span>
                  <span class={s.divider}>/</span>
                  <input class={s.allocated} type="number" min="0" step="0.01" aria-label="{cat.name} allocated amount" value={cat.allocated} oninput={event => { const next = parseAmount(event.currentTarget.value); if (next !== null) cat.allocated = next; }} onclick={event => event.stopPropagation()} />
                  <Button.Root type="button" class={s.deleteCat} data-slop-export="hide" aria-label="Delete {cat.name}" onclick={() => removeCategory(cat.id)}>
                    <Trash2 size={12} />
                  </Button.Root>
                </div>
              </div>
              <Progress.Root value={percent} max={100} class={s.catTrack} aria-label="{cat.name} budget spent">
                <div class={s.catFill} data-over={isOver} style:transform={`scaleX(${fillWidth(cat) / 100})`} aria-hidden="true"></div>
              </Progress.Root>
            </li>
          {:else}
            <li class={s.empty}>
              <strong>No categories yet.</strong>
              Add a line, then punch an amount on the calculator and log it.
            </li>
          {/each}
        </ul>
      </div>
    </section>

    <section class={s.calc} aria-label="Pocket calculator">
      <div class={s.lcd}>
        <div class={s.lcdHistory}>{calcHistory}</div>
        <div class={s.lcdDigits}>{calcDisplay}</div>
      </div>

      <div class={s.route} data-slop-export="hide">
        <Button.Root type="button" class={s.routeBtn} disabled={!selectedCategory || routeAmount <= 0 || doc.isLoading} onclick={routeToCategory}>
          <span>Log +{formatCurrency(routeAmount)}</span>
          <ArrowRight size={13} />
          <span>{selectedCategory ? selectedCategory.name : "Select category"}</span>
        </Button.Root>
      </div>

      <div class={s.keys} aria-label="Calculator keys">
        <button type="button" class={s.key} data-kind="fn" onclick={() => handleMemory("MC")}>MC</button>
        <button type="button" class={s.key} data-kind="fn" onclick={() => handleMemory("MR")}>MR</button>
        <button type="button" class={s.key} data-kind="fn" onclick={() => handleMemory("M+")}>M+</button>
        <button type="button" class={s.key} data-kind="fn" onclick={() => handleMemory("M-")}>M-</button>
        <button type="button" class={s.key} onclick={() => inputDigit("7")}>7</button>
        <button type="button" class={s.key} onclick={() => inputDigit("8")}>8</button>
        <button type="button" class={s.key} onclick={() => inputDigit("9")}>9</button>
        <button type="button" class={s.key} data-kind="op" data-active={calcOp === "/"} onclick={() => handleOp("/")}>÷</button>
        <button type="button" class={s.key} onclick={() => inputDigit("4")}>4</button>
        <button type="button" class={s.key} onclick={() => inputDigit("5")}>5</button>
        <button type="button" class={s.key} onclick={() => inputDigit("6")}>6</button>
        <button type="button" class={s.key} data-kind="op" data-active={calcOp === "*"} onclick={() => handleOp("*")}>×</button>
        <button type="button" class={s.key} onclick={() => inputDigit("1")}>1</button>
        <button type="button" class={s.key} onclick={() => inputDigit("2")}>2</button>
        <button type="button" class={s.key} onclick={() => inputDigit("3")}>3</button>
        <button type="button" class={s.key} data-kind="op" data-active={calcOp === "-"} onclick={() => handleOp("-")}>−</button>
        <button type="button" class={s.key} data-kind="fn" onclick={clearCalc}>C</button>
        <button type="button" class={s.key} onclick={() => inputDigit("0")}>0</button>
        <button type="button" class={s.key} onclick={inputDot}>.</button>
        <button type="button" class={s.key} data-kind="op" data-active={calcOp === "+"} onclick={() => handleOp("+")}>+</button>
        <button type="button" class={s.key} data-kind="accent" onclick={handleEquals}>=</button>
      </div>
    </section>
  </div>

  {#if doc.error}
    <div class={s.error} role="alert">
      <span>{doc.isReady ? "Changes haven’t been saved." : "This ledger couldn’t be loaded."} {doc.error}</span>
    </div>
  {:else if doc.isLoading}<p class={s.error} role="status">Loading the ledger…</p>{/if}
</main>

<IconTarget><Icon /></IconTarget>
<ExportTarget><Export data={doc.current} /></ExportTarget>
