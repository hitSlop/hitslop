<script lang="ts">
  import { capture } from "@hitslop/runtime";
  import { jsonStore } from "@hitslop/svelte";
  import BarChart3 from "@lucide/svelte/icons/chart-column";
  import RotateCcw from "@lucide/svelte/icons/rotate-ccw";
  import Share2 from "@lucide/svelte/icons/share-2";
  import X from "@lucide/svelte/icons/x";
  import { Dialog, Progress } from "bits-ui";
  import Icon from "./Icon.svelte";
  import {
    evaluateGuess,
    getDailyWord,
    getRandomWord,
    isValidWord,
    type TileState,
  } from "./words";

  type GameState = {
    targetWord: string;
    guesses: string[];
    status: "playing" | "won" | "lost";
    date?: string;
  };

  type WordleStore = {
    mode: "daily" | "practice";
    daily: GameState;
    practice: GameState;
    stats: {
      played: number;
      won: number;
      currentStreak: number;
      maxStreak: number;
      guessDistribution: Record<number, number>;
    };
  };

  const initialDaily = getDailyWord();

  const store = jsonStore<WordleStore>({
    mode: "daily",
    daily: {
      targetWord: initialDaily.word,
      guesses: [],
      status: "playing",
      date: initialDaily.dateStr,
    },
    practice: {
      targetWord: getRandomWord(),
      guesses: [],
      status: "playing",
    },
    stats: {
      played: 0,
      won: 0,
      currentStreak: 0,
      maxStreak: 0,
      guessDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 },
    },
  });

  // Check if daily puzzle needs rollover to today
  $effect(() => {
    const today = getDailyWord();
    if (store.current.daily.date !== today.dateStr) {
      store.current.daily = {
        targetWord: today.word,
        guesses: [],
        status: "playing",
        date: today.dateStr,
      };
    }
  });

  let currentGuess = $state("");
  let shakeRow = $state(false);
  let toastMessage = $state<string | null>(null);
  let toastTimer: ReturnType<typeof setTimeout> | null = null;
  let showStatsModal = $state(false);

  const activeState = $derived(
    store.current.mode === "daily" ? store.current.daily : store.current.practice
  );

  const isGameOver = $derived(activeState.status !== "playing");

  function showToast(msg: string, duration = 1800) {
    if (toastTimer) clearTimeout(toastTimer);
    toastMessage = msg;
    toastTimer = setTimeout(() => {
      toastMessage = null;
      toastTimer = null;
    }, duration);
  }

  function handleKey(char: string) {
    if (isGameOver) return;
    const c = char.toUpperCase();

    if (c === "ENTER") {
      submitGuess();
      return;
    }

    if (c === "BACKSPACE" || c === "DELETE" || c === "⌫") {
      if (currentGuess.length > 0) {
        currentGuess = currentGuess.slice(0, -1);
      }
      return;
    }

    if (/^[A-Z]$/.test(c)) {
      if (currentGuess.length < 5) {
        currentGuess += c;
      }
    }
  }

  function triggerShake() {
    shakeRow = true;
    setTimeout(() => {
      shakeRow = false;
    }, 450);
  }

  function submitGuess() {
    if (currentGuess.length < 5) {
      showToast("Not enough letters");
      triggerShake();
      return;
    }

    if (!isValidWord(currentGuess)) {
      showToast("Not in word list");
      triggerShake();
      return;
    }

    const guess = currentGuess;
    const target = activeState.targetWord;
    currentGuess = "";

    activeState.guesses.push(guess);

    const won = guess === target;
    const lost = !won && activeState.guesses.length >= 6;

    if (won || lost) {
      activeState.status = won ? "won" : "lost";
      updateStats(won, activeState.guesses.length);

      const winPraises = ["Genius!", "Magnificent!", "Impressive!", "Splendid!", "Great!", "Phew!"];
      const praise = winPraises[activeState.guesses.length - 1] ?? "Well done!";

      if (won) {
        showToast(praise, 2400);
      } else {
        showToast(`The word was ${target}`, 3200);
      }

      setTimeout(() => {
        showStatsModal = true;
      }, 1200);
    }
  }

  function updateStats(won: boolean, guessCount: number) {
    const s = store.current.stats;
    s.played += 1;
    if (won) {
      s.won += 1;
      s.currentStreak += 1;
      if (s.currentStreak > s.maxStreak) {
        s.maxStreak = s.currentStreak;
      }
      s.guessDistribution[guessCount] = (s.guessDistribution[guessCount] || 0) + 1;
    } else {
      s.currentStreak = 0;
    }
  }

  function startNewPractice() {
    store.current.practice = {
      targetWord: getRandomWord(),
      guesses: [],
      status: "playing",
    };
    currentGuess = "";
    showStatsModal = false;
    showToast("New Practice Game");
  }

  // Evaluate letter statuses for the keyboard
  const keyboardLetterStates = $derived.by(() => {
    const letterMap: Record<string, TileState> = {};
    const target = activeState.targetWord;

    for (const guess of activeState.guesses) {
      const evaluation = evaluateGuess(guess, target);
      for (let i = 0; i < 5; i++) {
        const char = guess[i]!;
        const currentBest = letterMap[char];
        const status = evaluation[i]!;

        if (status === "correct") {
          letterMap[char] = "correct";
        } else if (status === "present" && currentBest !== "correct") {
          letterMap[char] = "present";
        } else if (!currentBest) {
          letterMap[char] = status;
        }
      }
    }
    return letterMap;
  });

  // Physical keyboard listener
  function onWindowKeyDown(e: KeyboardEvent) {
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
    if (showStatsModal && e.key === "Escape") {
      showStatsModal = false;
      return;
    }
    handleKey(e.key);
  }

  function shareResult() {
    const target = activeState.targetWord;
    const isDaily = store.current.mode === "daily";
    const header = isDaily
      ? `hitSlop Wordle (${store.current.daily.date}) ${activeState.status === "won" ? activeState.guesses.length : "X"}/6`
      : `hitSlop Wordle (Practice) ${activeState.status === "won" ? activeState.guesses.length : "X"}/6`;

    const emojiRows = activeState.guesses.map((guess) => {
      const evaluation = evaluateGuess(guess, target);
      return evaluation
        .map((s) => (s === "correct" ? "🟩" : s === "present" ? "🟨" : "⬛"))
        .join("");
    });

    const shareText = `${header}\n\n${emojiRows.join("\n")}`;

    if (navigator.clipboard) {
      navigator.clipboard.writeText(shareText);
      showToast("Copied to clipboard!");
    }
  }

  const KEYBOARD_ROWS = [
    ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
    ["A", "S", "D", "F", "G", "H", "J", "K", "L"],
    ["ENTER", "Z", "X", "C", "V", "B", "N", "M", "⌫"],
  ];
</script>

<svelte:window onkeydown={onWindowKeyDown} />

<main class="wordle-device">
  <!-- Top Navigation -->
  <header class="top-nav">
    <div class="nav-group">
      <div class="brand-title">
        <span class="brand-dot"></span>
        <span>WORDLE</span>
      </div>
    </div>

    <div class="nav-group" data-slop-export="hide">
      <div class="mode-pill" role="tablist" aria-label="Game mode">
        <button
          type="button"
          class="mode-btn"
          class:active={store.current.mode === "daily"}
          onclick={() => { store.current.mode = "daily"; currentGuess = ""; }}
        >
          Daily
        </button>
        <button
          type="button"
          class="mode-btn"
          class:active={store.current.mode === "practice"}
          onclick={() => { store.current.mode = "practice"; currentGuess = ""; }}
        >
          Practice
        </button>
      </div>

      {#if store.current.mode === "practice"}
        <button
          type="button"
          class="icon-btn"
          aria-label="New practice game"
          title="New practice game"
          onclick={startNewPractice}
        >
          <RotateCcw size={15} />
        </button>
      {/if}

      <button
        type="button"
        class="icon-btn"
        aria-label="Statistics"
        title="Statistics"
        onclick={() => (showStatsModal = true)}
      >
        <BarChart3 size={15} />
      </button>
    </div>
  </header>

  <!-- Notification Toast -->
  {#if toastMessage}
    <div class="toast-container" role="status" aria-live="polite">
      <div class="toast">{toastMessage}</div>
    </div>
  {/if}

  <!-- Wordle Grid -->
  <div class="board-container">
    <div class="grid" role="grid" aria-label="Wordle 6 by 5 game board">
      {#each Array(6) as _, rowIndex}
        {@const completedGuess = activeState.guesses[rowIndex]}
        {@const isCurrentRow = !isGameOver && rowIndex === activeState.guesses.length}
        {@const evaluation = completedGuess ? evaluateGuess(completedGuess, activeState.targetWord) : null}

        <div
          class="row"
          class:shake={isCurrentRow && shakeRow}
          role="row"
        >
          {#each Array(5) as _, colIndex}
            {@const char = completedGuess ? completedGuess[colIndex] : (isCurrentRow ? (currentGuess[colIndex] || "") : "")}
            {@const stateClass = evaluation ? evaluation[colIndex] : ""}

            <div
              class="tile {stateClass}"
              class:filled={Boolean(char)}
              class:flip={Boolean(completedGuess)}
              style={completedGuess ? `animation-delay: ${colIndex * 100}ms;` : ""}
              role="gridcell"
              aria-label={char ? `${char} ${stateClass || "typed"}` : "empty"}
            >
              {char}
            </div>
          {/each}
        </div>
      {/each}
    </div>
  </div>

  <!-- On-Screen Keyboard -->
  <footer class="keyboard" aria-label="Virtual keyboard">
    {#each KEYBOARD_ROWS as row}
      <div class="keyboard-row">
        {#each row as key}
          {@const isWide = key === "ENTER" || key === "⌫"}
          {@const status = keyboardLetterStates[key] || ""}
          <button
            type="button"
            class="key {status}"
            class:wide={isWide}
            aria-label={key === "⌫" ? "Backspace" : key}
            onclick={() => handleKey(key)}
          >
            {key}
          </button>
        {/each}
      </div>
    {/each}
  </footer>

  <!-- Stats Modal -->
  <Dialog.Root bind:open={showStatsModal}>
    <Dialog.Portal>
      <Dialog.Overlay class="modal-overlay" data-slop-export="hide" />
      <Dialog.Content class="stats-card" aria-labelledby="stats-title" data-slop-export="hide">
        <div class="stats-header">
          <Dialog.Title id="stats-title">STATISTICS</Dialog.Title>
          <Dialog.Close class="icon-btn" aria-label="Close statistics">
            <X size={16} />
          </Dialog.Close>
        </div>

        <div class="stats-grid">
          <div class="stat-item">
            <span class="stat-value">{store.current.stats.played}</span>
            <span class="stat-label">Played</span>
          </div>
          <div class="stat-item">
            <span class="stat-value">
              {store.current.stats.played ? Math.round((store.current.stats.won / store.current.stats.played) * 100) : 0}%
            </span>
            <span class="stat-label">Win %</span>
          </div>
          <div class="stat-item">
            <span class="stat-value">{store.current.stats.currentStreak}</span>
            <span class="stat-label">Current Streak</span>
          </div>
          <div class="stat-item">
            <span class="stat-value">{store.current.stats.maxStreak}</span>
            <span class="stat-label">Max Streak</span>
          </div>
        </div>

        <div class="dist-section">
          <div class="dist-title">Guess Distribution</div>
          <div class="dist-rows">
            {#each [1, 2, 3, 4, 5, 6] as guessNum}
              {@const count = store.current.stats.guessDistribution[guessNum] || 0}
              {@const maxCount = Math.max(1, ...Object.values(store.current.stats.guessDistribution))}
              {@const percent = Math.round((count / maxCount) * 100)}
              {@const isCurrentWinGuess = isGameOver && activeState.status === "won" && activeState.guesses.length === guessNum}

              <div class="dist-row">
                <span class="dist-idx">{guessNum}</span>
                <Progress.Root
                  class="dist-bar-track"
                  value={count}
                  max={maxCount}
                >
                  <div
                    class="dist-bar"
                    class:highlight={isCurrentWinGuess}
                    style="width: {Math.max(8, percent)}%;"
                  >
                    {count}
                  </div>
                </Progress.Root>
              </div>
            {/each}
          </div>
        </div>

        <div class="modal-actions">
          {#if isGameOver}
            <button type="button" class="action-btn primary" onclick={shareResult}>
              <Share2 size={14} />
              <span>Share Result</span>
            </button>
          {/if}
          {#if store.current.mode === "practice"}
            <button type="button" class="action-btn secondary" onclick={startNewPractice}>
              <RotateCcw size={14} />
              <span>New Word</span>
            </button>
          {/if}
        </div>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>
</main>

{#if capture.isRenderer()}
  <Icon />
{/if}
