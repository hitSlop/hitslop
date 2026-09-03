<script lang="ts">
  import { capture } from "@hitslop/runtime";
  import { jsonStore } from "@hitslop/svelte";
  import Plus from "@lucide/svelte/icons/plus";
  import Trash2 from "@lucide/svelte/icons/trash-2";
  import Scale from "@lucide/svelte/icons/scale";
  import ThumbsUp from "@lucide/svelte/icons/thumbs-up";
  import ThumbsDown from "@lucide/svelte/icons/thumbs-down";
  import Icon from "./Icon.svelte";

  type Factor = { id: string; text: string; weight: number };
  type StatusType = "evaluating" | "leaning_pro" | "leaning_con" | "decided_pro" | "decided_con";

  type DecisionData = {
    question: string;
    date: string;
    status: StatusType;
    pros: Factor[];
    cons: Factor[];
    verdict: string;
  };

  function uid(): string {
    return Math.random().toString(36).slice(2, 9);
  }

  function todayStr(): string {
    const d = new Date();
    return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" });
  }

  const STATUS_LABELS: Record<StatusType, { label: string; tone: string }> = {
    evaluating: { label: "Evaluating", tone: "neutral" },
    leaning_pro: { label: "Leaning Pro", tone: "pro" },
    leaning_con: { label: "Leaning Con", tone: "con" },
    decided_pro: { label: "Decided: Proceed", tone: "decided-pro" },
    decided_con: { label: "Decided: Pass", tone: "decided-con" },
  };

  const store = jsonStore<DecisionData>({
    question: "Whether to accept the lead robotics architect role",
    date: todayStr(),
    status: "leaning_pro",
    pros: [
      { id: "p1", text: "Chance to design physical hardware from scratch", weight: 5 },
      { id: "p2", text: "25% salary increase plus equity package", weight: 4 },
      { id: "p3", text: "Talented and disciplined founding team", weight: 4 },
      { id: "p4", text: "Modern lab within bike-commute distance", weight: 3 },
    ],
    cons: [
      { id: "c1", text: "Higher daily stress and tight quarterly deadlines", weight: 4 },
      { id: "c2", text: "Will need to leave current close-knit team", weight: 3 },
      { id: "c3", text: "Early-stage startup runway risk (18 months)", weight: 3 },
    ],
    verdict: "The engineering growth and upside significantly surpass the risk profile. Prepare acceptance terms on Monday.",
  });

  let newProText = $state("");
  let newProWeight = $state(3);

  let newConText = $state("");
  let newConWeight = $state(3);

  const proTotal = $derived(store.current.pros.reduce((sum, f) => sum + f.weight, 0));
  const conTotal = $derived(store.current.cons.reduce((sum, f) => sum + f.weight, 0));
  const totalWeight = $derived(proTotal + conTotal);
  const netDelta = $derived(proTotal - conTotal);

  // Tilt angle between -15deg (heavy Con) and +15deg (heavy Pro)
  const tiltDeg = $derived(
    totalWeight === 0 ? 0 : Math.max(-15, Math.min(15, (netDelta / (totalWeight || 1)) * 30))
  );

  function addPro() {
    const text = newProText.trim();
    if (!text) return;
    store.current.pros = [...store.current.pros, { id: uid(), text, weight: newProWeight }];
    newProText = "";
    newProWeight = 3;
  }

  function addCon() {
    const text = newConText.trim();
    if (!text) return;
    store.current.cons = [...store.current.cons, { id: uid(), text, weight: newConWeight }];
    newConText = "";
    newConWeight = 3;
  }

  function deletePro(id: string) {
    store.current.pros = store.current.pros.filter((f) => f.id !== id);
  }

  function deleteCon(id: string) {
    store.current.cons = store.current.cons.filter((f) => f.id !== id);
  }

  function setProWeight(id: string, weight: number) {
    store.current.pros = store.current.pros.map((f) => (f.id === id ? { ...f, weight } : f));
  }

  function setConWeight(id: string, weight: number) {
    store.current.cons = store.current.cons.map((f) => (f.id === id ? { ...f, weight } : f));
  }
</script>

<main class="sheet-container">
  <!-- Letterhead Header -->
  <header class="sheet-header">
    <div class="meta-row">
      <span class="heritage-stamp">BENJAMIN FRANKLIN • PRUDENTIAL ALGEBRA</span>
      <input
        type="text"
        class="date-stamp"
        bind:value={store.current.date}
        aria-label="Decision Date"
      />
    </div>

    <div class="question-row">
      <span class="question-prefix">Whether to</span>
      <input
        type="text"
        class="question-input"
        placeholder="state the choice clearly..."
        bind:value={store.current.question}
        aria-label="Decision Statement"
      />
    </div>

    <!-- Live Prudential Balance Scale Bar -->
    <div class="balance-strip">
      <div class="scale-summary">
        <div class="score-pill score-pro">
          <ThumbsUp size={13} />
          <span class="score-label">Pros Total</span>
          <span class="score-num">{proTotal}</span>
        </div>

        <div class="balance-gauge-wrapper">
          <div class="beam-holder">
            <div
              class="balance-beam"
              style="transform: rotate({tiltDeg}deg)"
            >
              <div class="pan pan-left"></div>
              <div class="beam-bar"></div>
              <div class="pan pan-right"></div>
            </div>
            <div class="fulcrum"></div>
          </div>

          <div class="delta-badge" class:is-pro={netDelta > 0} class:is-con={netDelta < 0}>
            {#if netDelta > 0}
              +{netDelta} In Favor (Pro)
            {:else if netDelta < 0}
              {Math.abs(netDelta)} Against (Con)
            {:else}
              Even Balance
            {/if}
          </div>
        </div>

        <div class="score-pill score-con">
          <ThumbsDown size={13} />
          <span class="score-label">Cons Total</span>
          <span class="score-num">{conTotal}</span>
        </div>
      </div>
    </div>
  </header>

  <!-- Two-Column Prudential Spread -->
  <div class="columns-grid">
    <!-- Left Column: PROS -->
    <section class="column-card column-pro" aria-label="Reasons For (Pros)">
      <div class="column-header">
        <div class="col-title-group">
          <h2 class="col-title">Reasons For (Pros)</h2>
          <span class="col-sub">Motives, advantages, upside</span>
        </div>
        <span class="weight-badge">{proTotal} pts</span>
      </div>

      <ul class="factors-list">
        {#each store.current.pros as item (item.id)}
          <li class="factor-row">
            <input
              type="text"
              class="factor-text"
              bind:value={item.text}
              aria-label="Pro reason"
            />

            <div class="factor-meta">
              <!-- Weight Selector 1..5 -->
              <div class="weight-picker" title="Weight (1 = minor, 5 = decisive)">
                {#each [1, 2, 3, 4, 5] as w}
                  <button
                    type="button"
                    class="weight-btn"
                    class:active={item.weight === w}
                    onclick={() => setProWeight(item.id, w)}
                  >
                    {w}
                  </button>
                {/each}
              </div>

              <button
                type="button"
                class="del-btn"
                data-slop-export="hide"
                onclick={() => deletePro(item.id)}
                title="Remove item"
              >
                <Trash2 size={12} />
              </button>
            </div>
          </li>
        {/each}
      </ul>

      <!-- Add Pro Form -->
      <form
        class="add-factor-form"
        data-slop-export="hide"
        onsubmit={(e) => { e.preventDefault(); addPro(); }}
      >
        <input
          type="text"
          class="add-input"
          placeholder="Add pro argument..."
          bind:value={newProText}
        />
        <div class="weight-picker-inline">
          {#each [1, 2, 3, 4, 5] as w}
            <button
              type="button"
              class="weight-btn"
              class:active={newProWeight === w}
              onclick={() => { newProWeight = w; }}
            >
              {w}
            </button>
          {/each}
        </div>
        <button type="submit" class="add-btn" aria-label="Add Pro">
          <Plus size={14} />
        </button>
      </form>
    </section>

    <!-- Right Column: CONS -->
    <section class="column-card column-con" aria-label="Reasons Against (Cons)">
      <div class="column-header">
        <div class="col-title-group">
          <h2 class="col-title">Reasons Against (Cons)</h2>
          <span class="col-sub">Risks, costs, downsides</span>
        </div>
        <span class="weight-badge">{conTotal} pts</span>
      </div>

      <ul class="factors-list">
        {#each store.current.cons as item (item.id)}
          <li class="factor-row">
            <input
              type="text"
              class="factor-text"
              bind:value={item.text}
              aria-label="Con reason"
            />

            <div class="factor-meta">
              <!-- Weight Selector 1..5 -->
              <div class="weight-picker" title="Weight (1 = minor, 5 = decisive)">
                {#each [1, 2, 3, 4, 5] as w}
                  <button
                    type="button"
                    class="weight-btn"
                    class:active={item.weight === w}
                    onclick={() => setConWeight(item.id, w)}
                  >
                    {w}
                  </button>
                {/each}
              </div>

              <button
                type="button"
                class="del-btn"
                data-slop-export="hide"
                onclick={() => deleteCon(item.id)}
                title="Remove item"
              >
                <Trash2 size={12} />
              </button>
            </div>
          </li>
        {/each}
      </ul>

      <!-- Add Con Form -->
      <form
        class="add-factor-form"
        data-slop-export="hide"
        onsubmit={(e) => { e.preventDefault(); addCon(); }}
      >
        <input
          type="text"
          class="add-input"
          placeholder="Add con argument..."
          bind:value={newConText}
        />
        <div class="weight-picker-inline">
          {#each [1, 2, 3, 4, 5] as w}
            <button
              type="button"
              class="weight-btn"
              class:active={newConWeight === w}
              onclick={() => { newConWeight = w; }}
            >
              {w}
            </button>
          {/each}
        </div>
        <button type="submit" class="add-btn" aria-label="Add Con">
          <Plus size={14} />
        </button>
      </form>
    </section>
  </div>

  <!-- Verdict & Synthesis Foot -->
  <footer class="verdict-card">
    <div class="verdict-header">
      <span class="verdict-title">Verdict & Synthesis</span>
      <div class="status-selector" data-slop-export="hide">
        {#each (["evaluating", "leaning_pro", "leaning_con", "decided_pro", "decided_con"] as const) as st}
          <button
            type="button"
            class="status-btn"
            class:active={store.current.status === st}
            onclick={() => { store.current.status = st; }}
          >
            {STATUS_LABELS[st].label}
          </button>
        {/each}
      </div>
      <div class="export-status" data-slop-render="status">
        Status: {STATUS_LABELS[store.current.status].label}
      </div>
    </div>

    <textarea
      class="verdict-text"
      placeholder="Record your final conclusion, compromise terms, or resolution..."
      bind:value={store.current.verdict}
      rows={2}
    ></textarea>
  </footer>
</main>

{#if capture.isRenderer()}
  <Icon />
{/if}
