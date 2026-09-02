<script lang="ts">
  import { capture } from "@hitslop/runtime";
  import { jsonStore } from "@hitslop/svelte";
  import Plus from "@lucide/svelte/icons/plus";
  import Trash2 from "@lucide/svelte/icons/trash-2";
  import ArrowRight from "@lucide/svelte/icons/arrow-right";
  import Icon from "./Icon.svelte";

  type Category = {
    id: string;
    name: string;
    allocated: number;
    spent: number;
  };

  type BudgetData = {
    month: string;
    income: number;
    savings: number;
    categories: Category[];
  };

  const budget = jsonStore<BudgetData>({
    month: "May 2025",
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
  });

  // Selected category to route expense entries
  let selectedCategoryId = $state<string>("2");

  // Calculator state
  let calcDisplay = $state("0");
  let calcPrev = $state<number | null>(null);
  let calcOp = $state<string | null>(null);
  let waitingForOperand = $state(false);
  let calcMemory = $state(0);
  let calcHistory = $state("");

  // Derived budget figures
  const totalSpent = $derived(
    budget.current.categories.reduce((sum, cat) => sum + (Number(cat.spent) || 0), 0)
  );
  const totalAllocated = $derived(
    budget.current.categories.reduce((sum, cat) => sum + (Number(cat.allocated) || 0), 0)
  );
  const leftToBudget = $derived(budget.current.income - totalSpent);

  const selectedCategory = $derived(
    budget.current.categories.find((c) => c.id === selectedCategoryId)
  );

  function formatCurrency(num: number): string {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
    }).format(num);
  }

  function addCategory() {
    const newId = crypto.randomUUID();
    budget.current.categories.push({
      id: newId,
      name: "New Category",
      allocated: 200,
      spent: 0,
    });
    selectedCategoryId = newId;
  }

  function removeCategory(id: string, e: MouseEvent) {
    e.stopPropagation();
    budget.current.categories = budget.current.categories.filter((c) => c.id !== id);
    if (selectedCategoryId === id && budget.current.categories.length > 0) {
      selectedCategoryId = budget.current.categories[0].id;
    }
  }

  // Calculator engine
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
    if (!calcDisplay.includes(".")) {
      calcDisplay += ".";
    }
  }

  function clearCalc() {
    calcDisplay = "0";
    calcPrev = null;
    calcOp = null;
    waitingForOperand = false;
    calcHistory = "";
  }

  function handleOp(nextOp: string) {
    const inputValue = parseFloat(calcDisplay);

    if (calcPrev === null) {
      calcPrev = inputValue;
    } else if (calcOp && !waitingForOperand) {
      const current = calcPrev || 0;
      const result = compute(current, inputValue, calcOp);
      calcDisplay = String(result);
      calcPrev = result;
    }

    waitingForOperand = true;
    calcOp = nextOp;
    calcHistory = `${calcPrev} ${nextOp}`;
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

  function handleEquals() {
    const inputValue = parseFloat(calcDisplay);
    if (calcOp && calcPrev !== null) {
      const result = compute(calcPrev, inputValue, calcOp);
      calcHistory = `${calcPrev} ${calcOp} ${inputValue} =`;
      calcDisplay = String(Math.round(result * 100) / 100);
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
    if (isNaN(amount) || amount <= 0 || !selectedCategory) return;
    selectedCategory.spent = Math.round((Number(selectedCategory.spent) + amount) * 100) / 100;
    calcHistory = `Logged +${formatCurrency(amount)} to ${selectedCategory.name}`;
  }

  function handleKeydown(e: KeyboardEvent) {
    if (["input", "textarea"].includes((e.target as HTMLElement)?.tagName?.toLowerCase())) {
      return;
    }
    if (e.key >= "0" && e.key <= "9") {
      inputDigit(e.key);
    } else if (e.key === ".") {
      inputDot();
    } else if (["+", "-", "*", "/"].includes(e.key)) {
      handleOp(e.key);
    } else if (e.key === "Enter" || e.key === "=") {
      e.preventDefault();
      handleEquals();
    } else if (e.key === "Escape" || e.key === "c" || e.key === "C") {
      clearCalc();
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<main class="budget-canvas">
  <div class="budget-chassis">
    <!-- Left: Ledger Overview -->
    <section class="ledger-panel" aria-label="Monthly Budget Ledger">
      <div class="ledger-header">
        <input
          class="month-input"
          aria-label="Budget Month"
          bind:value={budget.current.month}
        />
        <span class="overview-pill">Overview</span>
      </div>

      <!-- Hero remaining readout -->
      <div class="hero-balance-box">
        <span class="hero-balance-label">Remaining Balance</span>
        <span class="hero-balance-value">{formatCurrency(leftToBudget)}</span>
        <span class="hero-balance-subtitle">left of monthly income</span>
      </div>

      <!-- Quick figures -->
      <div class="stats-summary-row">
        <div class="stat-chip">
          <label for="income-input" class="stat-chip-label">Income</label>
          <input
            id="income-input"
            class="stat-chip-input"
            type="number"
            bind:value={budget.current.income}
          />
        </div>
        <div class="stat-chip">
          <span class="stat-chip-label">Expenses</span>
          <span class="stat-chip-input">{formatCurrency(totalSpent)}</span>
        </div>
        <div class="stat-chip">
          <label for="savings-input" class="stat-chip-label">Savings</label>
          <input
            id="savings-input"
            class="stat-chip-input"
            type="number"
            bind:value={budget.current.savings}
          />
        </div>
      </div>

      <!-- Category budget list -->
      <div class="categories-section">
        <div class="categories-heading-row">
          <span class="categories-title">Categories</span>
          <button
            class="add-btn"
            data-slop-export="hide"
            aria-label="Add spending category"
            onclick={addCategory}
          >
            <Plus size={14} />
          </button>
        </div>

        <ul class="categories-list">
          {#each budget.current.categories as cat (cat.id)}
            {@const percent = Math.min(100, Math.round(((cat.spent || 0) / (cat.allocated || 1)) * 100))}
            {@const isOver = (cat.spent || 0) > (cat.allocated || 0)}
            <li class="category-row" class:selected={selectedCategoryId === cat.id}>
              <div class="category-meta-row">
                <button
                  type="button"
                  class="cat-select-btn"
                  class:active={selectedCategoryId === cat.id}
                  aria-label="Select {cat.name} for calculator"
                  onclick={() => (selectedCategoryId = cat.id)}
                >
                  <span class="cat-dot"></span>
                </button>
                <input
                  class="category-name-input"
                  aria-label="Category name"
                  bind:value={cat.name}
                  onfocus={() => (selectedCategoryId = cat.id)}
                />
                <div class="category-figures">
                  <span class="spent-figure">{formatCurrency(cat.spent)}</span>
                  <span class="figure-divider">/</span>
                  <input
                    class="budget-figure-input"
                    aria-label="{cat.name} budget limit"
                    type="number"
                    bind:value={cat.allocated}
                    onclick={(e) => e.stopPropagation()}
                  />
                  <button
                    class="delete-cat-btn"
                    data-slop-export="hide"
                    aria-label="Delete {cat.name}"
                    onclick={(e) => removeCategory(cat.id, e)}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>

              <div class="category-progress-track">
                <div
                  class="category-progress-fill"
                  class:overbudget={isOver}
                  style="width: {percent}%;"
                ></div>
              </div>
            </li>
          {/each}
        </ul>
      </div>
    </section>

    <!-- Right: Tactile Hardware Calculator -->
    <section class="calc-panel" aria-label="Tactile Pocket Calculator">
      <!-- LCD Screen -->
      <div class="calc-lcd-bezel">
        <div class="calc-lcd-history">{calcHistory}</div>
        <div class="calc-lcd-digits">{calcDisplay}</div>
      </div>

      <!-- Quick Route to Category -->
      <div class="route-action-bar" data-slop-export="hide">
        <button
          class="route-btn"
          disabled={!selectedCategory || parseFloat(calcDisplay) <= 0}
          onclick={routeToCategory}
        >
          <span>Log +{formatCurrency(parseFloat(calcDisplay) || 0)}</span>
          <ArrowRight size={13} />
          <span>{selectedCategory ? selectedCategory.name : "Select category"}</span>
        </button>
      </div>

      <!-- Buttons Grid -->
      <div class="calc-grid">
        <button class="calc-key key-fn" onclick={() => handleMemory("MC")}>MC</button>
        <button class="calc-key key-fn" onclick={() => handleMemory("MR")}>MR</button>
        <button class="calc-key key-fn" onclick={() => handleMemory("M+")}>M+</button>
        <button class="calc-key key-fn" onclick={() => handleMemory("M-")}>M-</button>

        <button class="calc-key" onclick={() => inputDigit("7")}>7</button>
        <button class="calc-key" onclick={() => inputDigit("8")}>8</button>
        <button class="calc-key" onclick={() => inputDigit("9")}>9</button>
        <button class="calc-key key-op" class:active={calcOp === "/"} onclick={() => handleOp("/")}>÷</button>

        <button class="calc-key" onclick={() => inputDigit("4")}>4</button>
        <button class="calc-key" onclick={() => inputDigit("5")}>5</button>
        <button class="calc-key" onclick={() => inputDigit("6")}>6</button>
        <button class="calc-key key-op" class:active={calcOp === "*"} onclick={() => handleOp("*")}>×</button>

        <button class="calc-key" onclick={() => inputDigit("1")}>1</button>
        <button class="calc-key" onclick={() => inputDigit("2")}>2</button>
        <button class="calc-key" onclick={() => inputDigit("3")}>3</button>
        <button class="calc-key key-op" class:active={calcOp === "-"} onclick={() => handleOp("-")}>−</button>

        <button class="calc-key key-fn" onclick={clearCalc}>C</button>
        <button class="calc-key" onclick={() => inputDigit("0")}>0</button>
        <button class="calc-key" onclick={inputDot}>.</button>
        <button class="calc-key key-op" class:active={calcOp === "+"} onclick={() => handleOp("+")}>+</button>

        <button
          class="calc-key key-accent"
          style="grid-column: span 4;"
          onclick={handleEquals}
        >=</button>
      </div>
    </section>
  </div>
</main>

{#if capture.isRenderer()}
  <Icon />
{/if}
