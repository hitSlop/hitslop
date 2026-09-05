<script lang="ts">
  import { capture } from "@hitslop/runtime";
  import { jsonStore } from "@hitslop/svelte";
  import { Calendar, Popover, Dialog, Checkbox } from "bits-ui";
  import { CalendarDate, getLocalTimeZone, today, type DateValue } from "@internationalized/date";
  import Plus from "@lucide/svelte/icons/plus";
  import Trash2 from "@lucide/svelte/icons/trash-2";
  import Check from "@lucide/svelte/icons/check";
  import CalendarIcon from "@lucide/svelte/icons/calendar";
  import ChevronLeft from "@lucide/svelte/icons/chevron-left";
  import ChevronRight from "@lucide/svelte/icons/chevron-right";
  import Heart from "@lucide/svelte/icons/heart";
  import Star from "@lucide/svelte/icons/star";
  import Search from "@lucide/svelte/icons/search";
  import Turtle from "@lucide/svelte/icons/turtle";
  import Sprout from "@lucide/svelte/icons/sprout";
  import Rocket from "@lucide/svelte/icons/rocket";
  import Smile from "@lucide/svelte/icons/smile";
  import Mountain from "@lucide/svelte/icons/mountain";
  import Compass from "@lucide/svelte/icons/compass";
  import Sparkles from "@lucide/svelte/icons/sparkles";
  import ArrowLeft from "@lucide/svelte/icons/arrow-left";
  import ArrowRight from "@lucide/svelte/icons/arrow-right";
  import Sun from "@lucide/svelte/icons/sun";
  import Moon from "@lucide/svelte/icons/moon";
  import Map from "@lucide/svelte/icons/map";
  import ListOrdered from "@lucide/svelte/icons/list-ordered";
  import Icon from "./Icon.svelte";

  type MoveItem = { id: string; text: string };

  type ChoicePointData = {
    date: string;
    situation: string;
    hooks: string[];
    values: string[];
    awayMoves: MoveItem[];
    towardsMoves: MoveItem[];
    stop: {
      slow: boolean;
      takeNote: boolean;
      openUp: boolean;
      pursue: boolean;
    };
    nextMove: string;
    nextWhen: string;
    nextDone: boolean;
    introDismissed?: boolean;
    theme?: "light" | "dark";
  };

  const STEPS = [
    { id: "situation", label: "1. Situation" },
    { id: "hooks", label: "2. Hooks" },
    { id: "fork", label: "3. The Fork" },
    { id: "stop", label: "4. STOP" },
    { id: "action", label: "5. Action" },
    { id: "map", label: "✦ Full Map" },
  ] as const;

  const STOP_STEPS = [
    {
      key: "slow" as const,
      letter: "S",
      title: "S — Slow down",
      hint: "Pause. Take a deep breath. Let your body settle.",
      icon: Turtle,
    },
    {
      key: "takeNote" as const,
      letter: "T",
      title: "T — Take note",
      hint: "What am I thinking, feeling, or urging right now?",
      icon: Search,
    },
    {
      key: "openUp" as const,
      letter: "O",
      title: "O — Open up",
      hint: "Make room for what’s here, without fighting or numbing.",
      icon: Heart,
    },
    {
      key: "pursue" as const,
      letter: "P",
      title: "P — Pursue values",
      hint: "What kind of person do I want to be right now?",
      icon: Star,
    },
  ];

  const COMMON_HOOKS = [
    "Self-doubt",
    "Urge to shut down",
    "Anxiety in chest",
    "I should know this",
    "Frustration",
    "Fear of failing",
    "Imposter thoughts",
  ];

  const COMMON_VALUES = [
    "Humility",
    "Courage",
    "Craft",
    "Kindness",
    "Honesty",
    "Curiosity",
    "Patience",
  ];

  const INTRO = [
    {
      kicker: "1 of 3 · The moment",
      title: "Name what’s happening.",
      body: "Start with the challenging situation plainly — the trigger. Hooks (thoughts, feelings, urges) are internal reactions that hook you. They are not moves.",
    },
    {
      kicker: "2 of 3 · The fork in the road",
      title: "Away or towards.",
      body: "At the Choice Point, you have two directions. Away moves pull you away from the person you want to be. Towards moves act on what truly matters, guided by your values.",
    },
    {
      kicker: "3 of 3 · The choice",
      title: "STOP, then one tiny move.",
      body: "Slow down, take note, open up, pursue values. Then choose one small, doable towards action and commit to a time.",
    },
  ] as const;

  function uid(): string {
    return Math.random().toString(36).slice(2, 9);
  }

  function todayStr(): string {
    const d = new Date();
    return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" });
  }

  function autosize(node: HTMLTextAreaElement) {
    const resize = () => {
      node.style.height = "0px";
      node.style.height = `${node.scrollHeight}px`;
    };

    resize();
    node.addEventListener("input", resize);
    return {
      update: resize,
      destroy: () => node.removeEventListener("input", resize),
    };
  }

  const store = jsonStore<ChoicePointData>({
    date: todayStr(),
    situation: "Feedback landed hard in the team review.",
    hooks: [
      "I should already know this",
      "A flush of embarrassment",
      "Urge to shut down",
    ],
    values: ["Craft", "Humility", "Collaboration"],
    awayMoves: [
      { id: "a1", text: "Avoid the revision" },
      { id: "a2", text: "Get sharp with my teammates" },
    ],
    towardsMoves: [
      { id: "t1", text: "Thank them for catching it" },
      { id: "t2", text: "Take a breath, then pair on the fix" },
    ],
    stop: {
      slow: true,
      takeNote: true,
      openUp: false,
      pursue: false,
    },
    nextMove: "Thank them, then pair on the first fix.",
    nextWhen: "Right after this meeting",
    nextDone: false,
    introDismissed: false,
    theme: "light",
  });

  let activeStep = $state(0);
  let newAwayText = $state("");
  let newTowardsText = $state("");
  let newHookText = $state("");
  let newValueText = $state("");
  let introStep = $state(0);
  let introOpen = $state(false);
  let calendarOpen = $state(false);
  let calendarValue = $state<DateValue | undefined>(today(getLocalTimeZone()));

  const showIntro = $derived(!capture.isRenderer() && (!store.current.introDismissed || introOpen));
  const currentTheme = $derived(store.current.theme ?? "light");
  const hooks = $derived(store.current.hooks ?? []);
  const values = $derived(store.current.values ?? []);
  const awayMoves = $derived(store.current.awayMoves ?? []);
  const towardsMoves = $derived(store.current.towardsMoves ?? []);
  const stop = $derived(
    store.current.stop ?? { slow: false, takeNote: false, openUp: false, pursue: false },
  );

  function toggleTheme() {
    store.current.theme = currentTheme === "dark" ? "light" : "dark";
  }

  function onDateSelect(val: DateValue | undefined) {
    if (!val) return;
    calendarValue = val;
    const d = val.toDate(getLocalTimeZone());
    store.current.date = d.toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    calendarOpen = false;
  }

  function addAway(textToAdd?: string) {
    const text = (textToAdd ?? newAwayText).trim();
    if (!text) return;
    store.current.awayMoves = [...awayMoves, { id: uid(), text }];
    if (!textToAdd) newAwayText = "";
  }

  function deleteAway(id: string) {
    store.current.awayMoves = awayMoves.filter((move) => move.id !== id);
  }

  function addTowards(textToAdd?: string) {
    const text = (textToAdd ?? newTowardsText).trim();
    if (!text) return;
    store.current.towardsMoves = [...towardsMoves, { id: uid(), text }];
    if (!textToAdd) newTowardsText = "";
  }

  function deleteTowards(id: string) {
    store.current.towardsMoves = towardsMoves.filter((move) => move.id !== id);
  }

  function addHook(textToAdd?: string) {
    const text = (textToAdd ?? newHookText).trim();
    if (!text) return;
    if (!hooks.includes(text)) {
      store.current.hooks = [...hooks, text];
    }
    if (!textToAdd) newHookText = "";
  }

  function deleteHook(index: number) {
    store.current.hooks = hooks.filter((_, itemIndex) => itemIndex !== index);
  }

  function addValue(textToAdd?: string) {
    const text = (textToAdd ?? newValueText).trim();
    if (!text) return;
    if (!values.includes(text)) {
      store.current.values = [...values, text];
    }
    if (!textToAdd) newValueText = "";
  }

  function deleteValue(index: number) {
    store.current.values = values.filter((_, itemIndex) => itemIndex !== index);
  }

  function toggleStop(key: keyof ChoicePointData["stop"]) {
    const current = store.current.stop ?? { slow: false, takeNote: false, openUp: false, pursue: false };
    store.current.stop = { ...current, [key]: !current[key] };
  }

  function goToStep(index: number) {
    activeStep = Math.max(0, Math.min(STEPS.length - 1, index));
  }

  function nextStep() {
    if (activeStep < STEPS.length - 1) {
      activeStep += 1;
    }
  }

  function prevStep() {
    if (activeStep > 0) {
      activeStep -= 1;
    }
  }

  function openIntro() {
    introStep = 0;
    introOpen = true;
  }

  function dismissIntro() {
    store.current.introDismissed = true;
    introOpen = false;
    introStep = 0;
  }

  function nextIntro() {
    if (introStep >= INTRO.length - 1) {
      dismissIntro();
      return;
    }
    introStep += 1;
  }

  function prevIntro() {
    introStep = Math.max(0, introStep - 1);
  }
</script>

<main class="sheet" class:theme-dark={currentTheme === "dark"}>
  <!-- Top Masthead -->
  <header class="masthead">
    <div class="masthead-badge">
      <span>✦ ACT / reflection tool</span>
    </div>
    <div class="masthead-center">
      <h1>Choice Point <Sparkles size={20} color="var(--lilac-accent)" /></h1>
      <p>A guided ACT exercise for pausing, noticing, and choosing your next move.</p>
    </div>
    <div class="masthead-meta">
      <!-- Bits UI Calendar Popover Picker -->
      <Popover.Root bind:open={calendarOpen}>
        <Popover.Trigger class="date-trigger" aria-label="Select date">
          <CalendarIcon size={13} />
          <span>Date:</span>
          <strong>{store.current.date}</strong>
        </Popover.Trigger>
        <Popover.Content class="calendar-popover" side="bottom" align="end" sideOffset={6}>
          <Calendar.Root
            type="single"
            value={calendarValue}
            onValueChange={onDateSelect}
          >
            {#snippet children({ months, weekdays })}
              <Calendar.Header class="cal-header">
                <Calendar.PrevButton class="cal-nav-btn" aria-label="Previous month">
                  <ChevronLeft size={14} />
                </Calendar.PrevButton>
                <Calendar.Heading class="cal-heading" />
                <Calendar.NextButton class="cal-nav-btn" aria-label="Next month">
                  <ChevronRight size={14} />
                </Calendar.NextButton>
              </Calendar.Header>
              {#each months as month}
                <Calendar.Grid class="cal-grid">
                  <Calendar.GridHead>
                    <Calendar.GridRow class="cal-row">
                      {#each weekdays as day}
                        <Calendar.HeadCell class="cal-head-cell">{day.slice(0, 2)}</Calendar.HeadCell>
                      {/each}
                    </Calendar.GridRow>
                  </Calendar.GridHead>
                  <Calendar.GridBody>
                    {#each month.weeks as weekDates}
                      <Calendar.GridRow class="cal-row">
                        {#each weekDates as date}
                          <Calendar.Cell {date} month={month.value} class="cal-cell">
                            <Calendar.Day class="cal-day" />
                          </Calendar.Cell>
                        {/each}
                      </Calendar.GridRow>
                    {/each}
                  </Calendar.GridBody>
                </Calendar.Grid>
              {/each}
            {/snippet}
          </Calendar.Root>
        </Popover.Content>
      </Popover.Root>

      <div class="meta-sub">
        <Heart size={11} color="var(--coral-accent)" />
        <span>Be kind as you move through this.</span>
        <div class="meta-actions">
          <button
            type="button"
            class="theme-btn"
            data-slop-export="hide"
            aria-label={`Switch to ${currentTheme === "dark" ? "light" : "dark"} mode`}
            title={`Switch to ${currentTheme === "dark" ? "light" : "dark"} mode`}
            onclick={toggleTheme}
          >
            {#if currentTheme === "dark"}
              <Sun size={12} />
            {:else}
              <Moon size={12} />
            {/if}
          </button>
          <button
            type="button"
            class="help-btn"
            data-slop-export="hide"
            aria-label="How this sheet works"
            title="How this sheet works"
            onclick={openIntro}
          >
            ?
          </button>
        </div>
      </div>
    </div>
  </header>

  <!-- Stepper Tabs -->
  <nav class="stepper-nav" data-slop-export="hide" aria-label="Activity Steps">
    <div class="step-tabs">
      {#each STEPS as step, index}
        <button
          type="button"
          class="step-tab"
          class:is-active={activeStep === index}
          onclick={() => goToStep(index)}
        >
          <span class="step-tab-num">{index + 1}</span>
          <span>{step.label}</span>
        </button>
      {/each}
    </div>
    <button
      type="button"
      class="mode-toggle-btn"
      onclick={() => goToStep(activeStep === 5 ? 0 : 5)}
    >
      {#if activeStep === 5}
        <ListOrdered size={13} />
        <span>Step Flow</span>
      {:else}
        <Map size={13} />
        <span>Full Map</span>
      {/if}
    </button>
  </nav>

  <!-- STEP 1: THE SITUATION -->
  {#if activeStep === 0}
    <div class="guided-step-container">
      <article class="guided-card">
        <header class="guided-header">
          <p class="guided-kicker">Step 1 of 5 · Grounding the Moment</p>
          <h2 class="guided-title">What’s happening right now?</h2>
          <p class="guided-desc">
            Describe the trigger or challenging moment plainly, as if a camera were recording it. Don't worry about fixing it yet—just name the moment.
          </p>
        </header>

        <div class="guided-body">
          <section class="card card-situation">
            <header class="card-head">
              <div class="card-icon" aria-hidden="true">
                <Mountain size={16} />
              </div>
              <div class="card-title-group">
                <h3 class="card-title">Challenging situation</h3>
                <p class="card-desc">What triggered this difficult feeling or urge?</p>
              </div>
            </header>
            <textarea
              class="situation-textarea"
              rows={3}
              use:autosize
              bind:value={store.current.situation}
              placeholder="e.g. Feedback landed hard in the team review, or a difficult email arrived…"
            ></textarea>
          </section>
        </div>

        <footer class="guided-footer">
          <span class="step-dots" aria-hidden="true">
            <span class="step-dot is-active"></span>
            <span class="step-dot"></span>
            <span class="step-dot"></span>
            <span class="step-dot"></span>
            <span class="step-dot"></span>
          </span>
          <button type="button" class="guided-next-btn" onclick={nextStep}>
            <span>Next: Notice Hooks</span>
            <ArrowRight size={14} />
          </button>
        </footer>
      </article>
    </div>

  <!-- STEP 2: HOOKS -->
  {:else if activeStep === 1}
    <div class="guided-step-container">
      <article class="guided-card">
        <header class="guided-header">
          <p class="guided-kicker">Step 2 of 5 · Internal Reactions</p>
          <h2 class="guided-title">What showed up to hook you?</h2>
          <p class="guided-desc">
            Hooks are the difficult thoughts, painful feelings, body sensations, or urges that showed up. They are not moves you make—they’re what pulls at your attention.
          </p>
        </header>

        <div class="guided-body">
          <section class="card card-hooks guided-coral">
            <header class="card-head">
              <div class="card-icon" aria-hidden="true">
                <svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M10 3v9a3 3 0 0 1-6 0 3 3 0 0 1 3-3h1" />
                </svg>
              </div>
              <div class="card-title-group">
                <h3 class="card-title">Your Hooks</h3>
                <p class="card-desc">Thoughts, feelings, urges, memories, physical sensations</p>
              </div>
            </header>

            <div class="chips-wrap">
              {#each hooks as hook, index (index)}
                <div class="chip-item">
                  <input
                    class="chip-input"
                    bind:value={store.current.hooks[index]}
                    aria-label={`Hook ${index + 1}`}
                    style="width: {Math.max(6, (hook?.length ?? 0) + 1)}ch"
                  />
                  <button
                    type="button"
                    class="chip-delete"
                    data-slop-export="hide"
                    onclick={() => deleteHook(index)}
                    aria-label={`Remove hook ${index + 1}`}
                  >
                    <Trash2 size={10} />
                  </button>
                </div>
              {/each}
              <form
                class="chip-add-form"
                data-slop-export="hide"
                onsubmit={(event) => {
                  event.preventDefault();
                  addHook();
                }}
              >
                <input class="chip-add-input" bind:value={newHookText} placeholder="Add a hook…" aria-label="New hook" />
                <button type="submit" class="chip-add-btn" aria-label="Add hook"><Plus size={13} /></button>
              </form>
            </div>
          </section>

          <!-- Suggested quick-add hooks -->
          <div class="suggestions-bar" data-slop-export="hide">
            <span class="suggestions-title">Tap to add common hooks:</span>
            <div class="suggestions-pills">
              {#each COMMON_HOOKS as item}
                <button type="button" class="suggest-btn" onclick={() => addHook(item)}>
                  <Plus size={11} />
                  <span>{item}</span>
                </button>
              {/each}
            </div>
          </div>
        </div>

        <footer class="guided-footer">
          <button type="button" class="guided-back-btn" onclick={prevStep}>
            <ArrowLeft size={14} />
            <span>Back</span>
          </button>
          <span class="step-dots" aria-hidden="true">
            <span class="step-dot"></span>
            <span class="step-dot is-active"></span>
            <span class="step-dot"></span>
            <span class="step-dot"></span>
            <span class="step-dot"></span>
          </span>
          <button type="button" class="guided-next-btn" onclick={nextStep}>
            <span>Next: The Fork</span>
            <ArrowRight size={14} />
          </button>
        </footer>
      </article>
    </div>

  <!-- STEP 3: THE FORK IN THE ROAD (AWAY VS. TOWARD) -->
  {:else if activeStep === 2}
    <div class="guided-step-container">
      <article class="guided-card">
        <header class="guided-header">
          <p class="guided-kicker">Step 3 of 5 · The Two Paths</p>
          <h2 class="guided-title">You stand at the Choice Point.</h2>
          <p class="guided-desc">
            Which direction will you steer? Map the behaviors that pull you away vs. the actions that steer you toward the person you want to be.
          </p>
        </header>

        <div class="guided-body">
          <div class="fork-step-grid">
            <!-- Left: Away Moves -->
            <section class="card card-away guided-coral">
              <header class="card-head">
                <div class="card-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="16" cy="5" r="2" />
                    <path d="M10 21l3-5-2-4 4-2-1.5-3" />
                    <path d="M6 16l4-2" />
                  </svg>
                </div>
                <div class="card-title-group">
                  <h3 class="card-title">Away moves</h3>
                  <p class="card-desc">If hooks take the wheel: actions pulling away from values</p>
                </div>
              </header>
              <ul class="moves-list">
                {#each awayMoves as move, index (move.id)}
                  <li class="move-item">
                    <span class="move-bullet" aria-hidden="true">•</span>
                    <textarea
                      class="move-textarea"
                      rows={1}
                      use:autosize
                      bind:value={move.text}
                      aria-label={`Away move ${index + 1}`}
                      placeholder="An away move…"
                    ></textarea>
                    <button
                      type="button"
                      class="move-delete"
                      data-slop-export="hide"
                      onclick={() => deleteAway(move.id)}
                      aria-label={`Remove away move ${index + 1}`}
                    >
                      <Trash2 size={12} />
                    </button>
                  </li>
                {/each}
              </ul>
              <form
                class="move-add-form"
                data-slop-export="hide"
                onsubmit={(event) => {
                  event.preventDefault();
                  addAway();
                }}
              >
                <input class="move-add-input" bind:value={newAwayText} placeholder="Add an away move…" aria-label="New away move" />
                <button type="submit" class="move-add-btn" aria-label="Add away move"><Plus size={14} /></button>
              </form>
            </section>

            <!-- Right: Toward Moves & Values -->
            <section class="card card-towards guided-teal">
              <header class="card-head">
                <div class="card-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="5" r="2" />
                    <path d="M10 21l2-7 3 2 2-6" />
                    <path d="M9 13l3-2" />
                  </svg>
                </div>
                <div class="card-title-group">
                  <h3 class="card-title">Toward moves</h3>
                  <p class="card-desc">Guided by values: actions moving toward what matters</p>
                </div>
              </header>
              <ul class="moves-list">
                {#each towardsMoves as move, index (move.id)}
                  <li class="move-item">
                    <span class="move-bullet" aria-hidden="true">•</span>
                    <textarea
                      class="move-textarea"
                      rows={1}
                      use:autosize
                      bind:value={move.text}
                      aria-label={`Towards move ${index + 1}`}
                      placeholder="A towards move…"
                    ></textarea>
                    <button
                      type="button"
                      class="move-delete"
                      data-slop-export="hide"
                      onclick={() => deleteTowards(move.id)}
                      aria-label={`Remove towards move ${index + 1}`}
                    >
                      <Trash2 size={12} />
                    </button>
                  </li>
                {/each}
              </ul>
              <form
                class="move-add-form"
                data-slop-export="hide"
                onsubmit={(event) => {
                  event.preventDefault();
                  addTowards();
                }}
              >
                <input class="move-add-input" bind:value={newTowardsText} placeholder="Add a towards move…" aria-label="New towards move" />
                <button type="submit" class="move-add-btn" aria-label="Add towards move"><Plus size={14} /></button>
              </form>
            </section>
          </div>

          <!-- Supporting Values/Helpers for Toward moves -->
          <section class="card card-values guided-teal">
            <header class="card-head">
              <div class="card-icon" aria-hidden="true">
                <Compass size={16} />
              </div>
              <div class="card-title-group">
                <h3 class="card-title">Values & Strengths to help you</h3>
                <p class="card-desc">What matters to you here? What qualities can you call upon?</p>
              </div>
            </header>
            <div class="chips-wrap">
              {#each values as value, index (index)}
                <div class="chip-item">
                  <input
                    class="chip-input"
                    bind:value={store.current.values[index]}
                    aria-label={`Value ${index + 1}`}
                    style="width: {Math.max(6, (value?.length ?? 0) + 1)}ch"
                  />
                  <button
                    type="button"
                    class="chip-delete"
                    data-slop-export="hide"
                    onclick={() => deleteValue(index)}
                    aria-label={`Remove value ${index + 1}`}
                  >
                    <Trash2 size={10} />
                  </button>
                </div>
              {/each}
              <form
                class="chip-add-form"
                data-slop-export="hide"
                onsubmit={(event) => {
                  event.preventDefault();
                  addValue();
                }}
              >
                <input class="chip-add-input" bind:value={newValueText} placeholder="Add a value…" aria-label="New value" />
                <button type="submit" class="chip-add-btn" aria-label="Add value"><Plus size={13} /></button>
              </form>
            </div>
            <!-- Suggested quick-add values -->
            <div class="suggestions-bar" data-slop-export="hide" style="margin-top: 4px;">
              <span class="suggestions-title">Tap to add values:</span>
              <div class="suggestions-pills">
                {#each COMMON_VALUES as item}
                  <button type="button" class="suggest-btn" onclick={() => addValue(item)}>
                    <Plus size={11} />
                    <span>{item}</span>
                  </button>
                {/each}
              </div>
            </div>
          </section>
        </div>

        <footer class="guided-footer">
          <button type="button" class="guided-back-btn" onclick={prevStep}>
            <ArrowLeft size={14} />
            <span>Back</span>
          </button>
          <span class="step-dots" aria-hidden="true">
            <span class="step-dot"></span>
            <span class="step-dot"></span>
            <span class="step-dot is-active"></span>
            <span class="step-dot"></span>
            <span class="step-dot"></span>
          </span>
          <button type="button" class="guided-next-btn" onclick={nextStep}>
            <span>Next: Practice STOP</span>
            <ArrowRight size={14} />
          </button>
        </footer>
      </article>
    </div>

  <!-- STEP 4: THE STOP SKILL -->
  {:else if activeStep === 3}
    <div class="guided-step-container">
      <article class="guided-card">
        <header class="guided-header">
          <p class="guided-kicker">Step 4 of 5 · Pause & Create Space</p>
          <h2 class="guided-title">Pause, make room, then choose.</h2>
          <p class="guided-desc">
            Before reacting automatically, take 30 seconds to run through the STOP skill. Tap each step to anchor yourself in the present moment.
          </p>
        </header>

        <div class="guided-body">
          <section class="stop-card" aria-label="STOP Skill">
            <div class="stop-header">
              <Sparkles size={14} />
              <span>The STOP Grounding Ritual</span>
            </div>
            <div class="stop-steps">
              {#each STOP_STEPS as step (step.key)}
                {@const IconComp = step.icon}
                <button
                  type="button"
                  class="stop-btn"
                  class:is-active={stop[step.key]}
                  onclick={() => toggleStop(step.key)}
                  aria-pressed={stop[step.key]}
                >
                  <div class="stop-icon-circle">
                    {#if stop[step.key]}
                      <Check size={20} strokeWidth={2.5} />
                    {:else}
                      <IconComp size={20} />
                    {/if}
                  </div>
                  <span class="stop-step-title">{step.title}</span>
                  <span class="stop-step-hint">{step.hint}</span>
                </button>
              {/each}
            </div>
          </section>
        </div>

        <footer class="guided-footer">
          <button type="button" class="guided-back-btn" onclick={prevStep}>
            <ArrowLeft size={14} />
            <span>Back</span>
          </button>
          <span class="step-dots" aria-hidden="true">
            <span class="step-dot"></span>
            <span class="step-dot"></span>
            <span class="step-dot"></span>
            <span class="step-dot is-active"></span>
            <span class="step-dot"></span>
          </span>
          <button type="button" class="guided-next-btn" onclick={nextStep}>
            <span>Next: Commit to a Move</span>
            <ArrowRight size={14} />
          </button>
        </footer>
      </article>
    </div>

  <!-- STEP 5: ONE TINY MOVE & COMMITMENT -->
  {:else if activeStep === 4}
    <div class="guided-step-container">
      <article class="guided-card">
        <header class="guided-header">
          <p class="guided-kicker">Step 5 of 5 · Action & Commitment</p>
          <h2 class="guided-title">Pick one tiny toward move.</h2>
          <p class="guided-desc">
            You don't have to fix everything right now. What is one small, realistic action you can take that aligns with your values?
          </p>
        </header>

        <div class="guided-body">
          <section class="commit-card">
            <div class="commit-col">
              <div class="commit-icon-badge">
                <Sprout size={20} />
              </div>
              <div class="commit-content">
                <div class="commit-title">One tiny toward move I can do now</div>
                <div class="commit-hint">Pick one small, doable action that moves you toward what matters</div>
                <textarea
                  class="commit-input"
                  rows={2}
                  use:autosize
                  bind:value={store.current.nextMove}
                  placeholder="e.g. Take a deep breath, thank them for catching it, or draft the reply…"
                ></textarea>
              </div>
            </div>
            <div class="commit-right">
              <div class="commit-col">
                <div class="commit-icon-badge">
                  <Rocket size={20} />
                </div>
                <div class="commit-content">
                  <div class="commit-title">When I'll do it</div>
                  <input
                    class="commit-input"
                    bind:value={store.current.nextWhen}
                    placeholder="e.g. Right after this meeting"
                    aria-label="When I'll do it"
                  />
                </div>
              </div>

              <!-- Bits UI Checkbox for 'I did it!' -->
              <label class="commit-done-label">
                <Checkbox.Root
                  bind:checked={store.current.nextDone}
                  class="done-box"
                  aria-label="Mark tiny move as done"
                >
                  {#snippet children({ checked })}
                    {#if checked}
                      <Check size={13} strokeWidth={3} />
                    {/if}
                  {/snippet}
                </Checkbox.Root>
                <span>I did it!</span>
                {#if store.current.nextDone}
                  <span class="done-smile"><Smile size={18} /></span>
                {/if}
              </label>
            </div>
          </section>
        </div>

        <footer class="guided-footer">
          <button type="button" class="guided-back-btn" onclick={prevStep}>
            <ArrowLeft size={14} />
            <span>Back</span>
          </button>
          <span class="step-dots" aria-hidden="true">
            <span class="step-dot"></span>
            <span class="step-dot"></span>
            <span class="step-dot"></span>
            <span class="step-dot"></span>
            <span class="step-dot is-active"></span>
          </span>
          <button type="button" class="guided-next-btn" onclick={() => goToStep(5)}>
            <span>View Full Map</span>
            <Map size={14} />
          </button>
        </footer>
      </article>
    </div>

  <!-- STEP 6 / FULL MAP VIEW -->
  {:else}
    <div class="full-map-container" style="display: flex; flex-direction: column; gap: 16px;">
      <!-- The Choice Landscape: 3 Columns -->
      <div class="board">
        <!-- Left Column: Away & Hooks (Warm Coral) -->
        <div class="board-col col-away">
          <!-- Hooks Card -->
          <section class="card card-hooks" aria-labelledby="hooks-heading">
            <header class="card-head">
              <div class="card-icon" aria-hidden="true">
                <svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M10 3v9a3 3 0 0 1-6 0 3 3 0 0 1 3-3h1" />
                </svg>
              </div>
              <div class="card-title-group">
                <h2 id="hooks-heading" class="card-title">Hooks</h2>
                <p class="card-desc">Thoughts, feelings, urges, memories, sensations</p>
              </div>
            </header>
            <div class="chips-wrap">
              {#each hooks as hook, index (index)}
                <div class="chip-item">
                  <input
                    class="chip-input"
                    bind:value={store.current.hooks[index]}
                    aria-label={`Hook ${index + 1}`}
                    style="width: {Math.max(6, (hook?.length ?? 0) + 1)}ch"
                  />
                  <button
                    type="button"
                    class="chip-delete"
                    data-slop-export="hide"
                    onclick={() => deleteHook(index)}
                    aria-label={`Remove hook ${index + 1}`}
                  >
                    <Trash2 size={10} />
                  </button>
                </div>
              {/each}
              <form
                class="chip-add-form"
                data-slop-export="hide"
                onsubmit={(event) => {
                  event.preventDefault();
                  addHook();
                }}
              >
                <input class="chip-add-input" bind:value={newHookText} placeholder="Add a hook…" aria-label="New hook" />
                <button type="submit" class="chip-add-btn" aria-label="Add hook"><Plus size={13} /></button>
              </form>
            </div>
          </section>

          <!-- Away Moves Card -->
          <section class="card card-away" aria-labelledby="away-heading">
            <header class="card-head">
              <div class="card-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="16" cy="5" r="2" />
                  <path d="M10 21l3-5-2-4 4-2-1.5-3" />
                  <path d="M6 16l4-2" />
                </svg>
              </div>
              <div class="card-title-group">
                <h2 id="away-heading" class="card-title">Away moves</h2>
                <p class="card-desc">Actions that move me away from who I want to be</p>
              </div>
            </header>
            <ul class="moves-list">
              {#each awayMoves as move, index (move.id)}
                <li class="move-item">
                  <span class="move-bullet" aria-hidden="true">•</span>
                  <textarea
                    class="move-textarea"
                    rows={1}
                    use:autosize
                    bind:value={move.text}
                    aria-label={`Away move ${index + 1}`}
                    placeholder="An away move…"
                  ></textarea>
                  <button
                    type="button"
                    class="move-delete"
                    data-slop-export="hide"
                    onclick={() => deleteAway(move.id)}
                    aria-label={`Remove away move ${index + 1}`}
                  >
                    <Trash2 size={12} />
                  </button>
                </li>
              {/each}
            </ul>
            <form
              class="move-add-form"
              data-slop-export="hide"
              onsubmit={(event) => {
                event.preventDefault();
                addAway();
              }}
            >
              <input class="move-add-input" bind:value={newAwayText} placeholder="Add an away move…" aria-label="New away move" />
              <button type="submit" class="move-add-btn" aria-label="Add away move"><Plus size={14} /></button>
            </form>
          </section>
        </div>

        <!-- Center Column: Fork Illustration & Challenging Situation -->
        <div class="board-col col-center">
          <!-- Illustrated Pathway Fork -->
          <div class="fork-illustration-wrap" aria-hidden="true">
            <svg class="fork-svg" viewBox="0 0 200 240" preserveAspectRatio="xMidYMid meet">
              <path d="M0 135 Q50 100 100 120 T200 110 L200 240 L0 240 Z" fill="var(--svg-hill-left)" opacity="0.8" />
              <path d="M0 155 Q60 135 110 160 T200 145 L200 240 L0 240 Z" fill="var(--svg-hill-right)" opacity="0.8" />

              <circle cx="174" cy="42" r="9" fill="#fcdba3" stroke="#f4ba5c" stroke-width="1.5" />
              <path d="M174 27 L174 30 M174 54 L174 57 M159 42 L162 42 M186 42 L189 42 M163 31 L165 33 M183 51 L185 53 M163 53 L165 51 M183 31 L185 33" stroke="#f4ba5c" stroke-width="1.5" stroke-linecap="round" />

              <path d="M100 240 L100 135" stroke="var(--svg-road-stem)" stroke-width="26" stroke-linecap="round" />
              <path d="M100 234 L100 145" stroke="var(--svg-road-dash)" stroke-width="2.5" stroke-dasharray="5 5" />

              <path d="M82 210 L84 204 M84 210 L87 202 M86 210 L90 205" stroke="#9bbba7" stroke-width="1.5" stroke-linecap="round" />
              <path d="M118 210 L116 204 M116 210 L113 202 M114 210 L110 205" stroke="#9bbba7" stroke-width="1.5" stroke-linecap="round" />

              <path d="M100 135 C75 110 40 85 24 50" stroke="var(--svg-road-left)" stroke-width="16" stroke-linecap="round" fill="none" />
              <path d="M100 135 C75 110 40 85 24 50" stroke="var(--coral-accent)" stroke-width="2" stroke-dasharray="4 4" fill="none" />
              <circle cx="24" cy="50" r="14" fill="var(--coral-accent)" />
              <path d="M27 45 L21 50 L27 55" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none" />

              <path d="M100 135 C125 110 160 85 176 50" stroke="var(--svg-road-right)" stroke-width="16" stroke-linecap="round" fill="none" />
              <path d="M100 135 C125 110 160 85 176 50" stroke="var(--teal-accent)" stroke-width="2" stroke-dasharray="4 4" fill="none" />
              <circle cx="176" cy="50" r="14" fill="var(--teal-accent)" />
              <path d="M173 45 L179 50 L173 55" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none" />

              <circle cx="100" cy="130" r="34" fill="var(--svg-medallion-outer)" stroke="var(--svg-medallion-border)" stroke-width="2.5" />
              <circle cx="100" cy="130" r="28" fill="var(--svg-medallion-inner)" stroke="var(--lilac-accent)" stroke-width="1.5" />
              <path d="M100 109 L100 120" stroke="var(--lilac-accent)" stroke-width="2" stroke-linecap="round" />
              <path d="M92 113 L108 113" stroke="var(--lilac-accent)" stroke-width="2" stroke-linecap="round" />
              <text x="100" y="131" text-anchor="middle" font-size="8.5" font-weight="800" fill="var(--svg-medallion-title)" font-family="-apple-system, sans-serif">Choice Point</text>
              <text x="100" y="141" text-anchor="middle" font-size="5.5" font-weight="600" fill="var(--svg-medallion-sub)" font-family="-apple-system, sans-serif">I can pause. I can choose.</text>
            </svg>
          </div>

          <!-- Challenging Situation Card -->
          <section class="card card-situation" aria-labelledby="situation-heading">
            <header class="card-head">
              <div class="card-icon" aria-hidden="true">
                <Mountain size={16} />
              </div>
              <div class="card-title-group">
                <h2 id="situation-heading" class="card-title">Challenging situation</h2>
                <p class="card-desc">What’s happening right now? What triggered this?</p>
              </div>
            </header>
            <textarea
              class="situation-textarea"
              rows={2}
              use:autosize
              bind:value={store.current.situation}
              placeholder="Name the challenging moment plainly…"
            ></textarea>
          </section>
        </div>

        <!-- Right Column: Toward & Values (Fresh Mint / Teal) -->
        <div class="board-col col-towards">
          <!-- Values Card -->
          <section class="card card-values" aria-labelledby="values-heading">
            <header class="card-head">
              <div class="card-icon" aria-hidden="true">
                <Compass size={16} />
              </div>
              <div class="card-title-group">
                <h2 id="values-heading" class="card-title">Values / strengths / skills</h2>
                <p class="card-desc">What matters to me, what helps me, skills I can use</p>
              </div>
            </header>
            <div class="chips-wrap">
              {#each values as value, index (index)}
                <div class="chip-item">
                  <input
                    class="chip-input"
                    bind:value={store.current.values[index]}
                    aria-label={`Value ${index + 1}`}
                    style="width: {Math.max(6, (value?.length ?? 0) + 1)}ch"
                  />
                  <button
                    type="button"
                    class="chip-delete"
                    data-slop-export="hide"
                    onclick={() => deleteValue(index)}
                    aria-label={`Remove value ${index + 1}`}
                  >
                    <Trash2 size={10} />
                  </button>
                </div>
              {/each}
              <form
                class="chip-add-form"
                data-slop-export="hide"
                onsubmit={(event) => {
                  event.preventDefault();
                  addValue();
                }}
              >
                <input class="chip-add-input" bind:value={newValueText} placeholder="Add a value…" aria-label="New value" />
                <button type="submit" class="chip-add-btn" aria-label="Add value"><Plus size={13} /></button>
              </form>
            </div>
          </section>

          <!-- Toward Moves Card -->
          <section class="card card-towards" aria-labelledby="towards-heading">
            <header class="card-head">
              <div class="card-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="5" r="2" />
                  <path d="M10 21l2-7 3 2 2-6" />
                  <path d="M9 13l3-2" />
                </svg>
              </div>
              <div class="card-title-group">
                <h2 id="towards-heading" class="card-title">Toward moves</h2>
                <p class="card-desc">Actions that move me toward what truly matters</p>
              </div>
            </header>
            <ul class="moves-list">
              {#each towardsMoves as move, index (move.id)}
                <li class="move-item">
                  <span class="move-bullet" aria-hidden="true">•</span>
                  <textarea
                    class="move-textarea"
                    rows={1}
                    use:autosize
                    bind:value={move.text}
                    aria-label={`Towards move ${index + 1}`}
                    placeholder="A towards move…"
                  ></textarea>
                  <button
                    type="button"
                    class="move-delete"
                    data-slop-export="hide"
                    onclick={() => deleteTowards(move.id)}
                    aria-label={`Remove towards move ${index + 1}`}
                  >
                    <Trash2 size={12} />
                  </button>
                </li>
              {/each}
            </ul>
            <form
              class="move-add-form"
              data-slop-export="hide"
              onsubmit={(event) => {
                event.preventDefault();
                addTowards();
              }}
            >
              <input class="move-add-input" bind:value={newTowardsText} placeholder="Add a towards move…" aria-label="New towards move" />
              <button type="submit" class="move-add-btn" aria-label="Add towards move"><Plus size={14} /></button>
            </form>
          </section>
        </div>
      </div>

      <!-- STOP Skill Strip -->
      <section class="stop-card" aria-label="STOP Skill">
        <div class="stop-header">
          <Sparkles size={14} />
          <span>Use the STOP skill to create space</span>
        </div>
        <div class="stop-steps">
          {#each STOP_STEPS as step (step.key)}
            {@const IconComp = step.icon}
            <button
              type="button"
              class="stop-btn"
              class:is-active={stop[step.key]}
              onclick={() => toggleStop(step.key)}
              aria-pressed={stop[step.key]}
            >
              <div class="stop-icon-circle">
                {#if stop[step.key]}
                  <Check size={18} strokeWidth={2.5} />
                {:else}
                  <IconComp size={18} />
                {/if}
              </div>
              <span class="stop-step-title">{step.title}</span>
              <span class="stop-step-hint">{step.hint}</span>
            </button>
          {/each}
        </div>
      </section>

      <!-- One Tiny Toward Move & Commitment -->
      <section class="commit-card">
        <div class="commit-col">
          <div class="commit-icon-badge">
            <Sprout size={18} />
          </div>
          <div class="commit-content">
            <div class="commit-title">One tiny toward move I can do now</div>
            <div class="commit-hint">Pick one small, doable action that moves me toward what matters</div>
            <textarea
              class="commit-input"
              rows={1}
              use:autosize
              bind:value={store.current.nextMove}
              placeholder="One small, immediate towards action…"
            ></textarea>
          </div>
        </div>
        <div class="commit-right">
          <div class="commit-col">
            <div class="commit-icon-badge">
              <Rocket size={18} />
            </div>
            <div class="commit-content">
              <div class="commit-title">When I'll do it</div>
              <input
                class="commit-input"
                bind:value={store.current.nextWhen}
                placeholder="A real, specific time…"
                aria-label="When I'll do it"
              />
            </div>
          </div>

          <!-- Bits UI Checkbox for 'I did it!' in full map -->
          <label class="commit-done-label">
            <Checkbox.Root
              bind:checked={store.current.nextDone}
              class="done-box"
              aria-label="Mark tiny move as done"
            >
              {#snippet children({ checked })}
                {#if checked}
                  <Check size={13} strokeWidth={3} />
                {/if}
              {/snippet}
            </Checkbox.Root>
            <span>I did it!</span>
            {#if store.current.nextDone}
              <span class="done-smile"><Smile size={17} /></span>
            {/if}
          </label>
        </div>
      </section>
    </div>
  {/if}

  <!-- Reassurance Motto -->
  <footer class="footer-motto">
    <span>✦</span>
    <span>You don’t have to feel ready. You just have to choose.</span>
    <Heart size={12} color="var(--coral-accent)" />
  </footer>
</main>

<!-- Bits UI Dialog for Intro Walkthrough -->
{#if showIntro}
  <Dialog.Root bind:open={introOpen}>
    <Dialog.Portal>
      <Dialog.Overlay class="intro" data-slop-export="hide" />
      <Dialog.Content class="intro-card" aria-labelledby="intro-title" data-slop-export="hide">
        <p class="intro-kicker">{INTRO[introStep].kicker}</p>
        <Dialog.Title id="intro-title" class="intro-title">{INTRO[introStep].title}</Dialog.Title>
        <Dialog.Description class="intro-body">{INTRO[introStep].body}</Dialog.Description>
        <div class="intro-nav">
          {#if introStep > 0}
            <button type="button" class="intro-ghost" onclick={prevIntro}>Back</button>
          {:else}
            <button type="button" class="intro-ghost" onclick={dismissIntro}>Skip</button>
          {/if}
          <button type="button" class="intro-next" onclick={nextIntro}>
            {introStep < INTRO.length - 1 ? "Next" : "Start worksheet"}
          </button>
        </div>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>
{/if}

{#if capture.isRenderer()}
  <Icon />
{/if}
