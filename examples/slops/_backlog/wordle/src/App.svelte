<script lang="ts">
  import { capture, ready } from "@hitslop/runtime";
  import { jsonStore, IconTarget, ExportTarget } from "@hitslop/svelte";
  import { Button, Dialog, Progress, Tabs } from "bits-ui";
  import { onDestroy, onMount, tick } from "svelte";
  import { Tween, prefersReducedMotion } from "svelte/motion";
  import { cubicOut } from "svelte/easing";
  import BarChart3 from "@lucide/svelte/icons/chart-column";
  import RotateCcw from "@lucide/svelte/icons/rotate-ccw";
  import Share2 from "@lucide/svelte/icons/share-2";
  import X from "@lucide/svelte/icons/x";
  import wordleSchema from "../schema";
  import type { GameState } from "../schema";
  import Icon from "./Icon.svelte";
  import Export from "./Export.svelte";
  import * as s from "./styles.css";
  import {
    evaluateGuess,
    getDailyWord,
    getRandomWord,
    isValidWord,
    type TileState,
  } from "./words";

  const ROWS = 6;
  const COLS = 5;
  const TILE_FLIP_MS = 420;
  const TILE_STAGGER = 80;
  const ROW_FLIP_MS = TILE_FLIP_MS + TILE_STAGGER * (COLS - 1);
  const WIN_PRAISES = ["Genius!", "Magnificent!", "Impressive!", "Splendid!", "Great!", "Phew!"];
  const KEYBOARD_ROWS = [
    ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
    ["A", "S", "D", "F", "G", "H", "J", "K", "L"],
    ["ENTER", "Z", "X", "C", "V", "B", "N", "M", "⌫"],
  ] as const;

  const initialDaily = getDailyWord();
  const store = jsonStore({
    schema: wordleSchema,
    initial: {
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
        guessDistribution: { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0, "6": 0 },
      },
    },
  });

  const rowReveals = Array.from({ length: ROWS }, () => new Tween(0, { duration: 0, easing: cubicOut }));

  let currentGuess = $state("");
  let shakeRow = $state(false);
  let toastMessage = $state<string | null>(null);
  let announcement = $state("");
  let showStatsModal = $state(false);
  let completionSession = $state(false);
  let revealing = $state(false);
  let pressedKey = $state<string | null>(null);
  let initialized = false;
  let lastGuessCount = 0;
  let lastMode: string | null = null;
  let toastTimer: ReturnType<typeof setTimeout> | null = null;
  let shakeTimer: ReturnType<typeof setTimeout> | null = null;
  let revealTimer: ReturnType<typeof setTimeout> | null = null;

  const activeState = $derived(store.current.mode === "daily" ? store.current.daily : store.current.practice);
  const isGameOver = $derived(activeState.status !== "playing");
  const winPercent = $derived(store.current.stats.played ? Math.round((store.current.stats.won / store.current.stats.played) * 100) : 0);
  const statusLine = $derived(
    activeState.status === "won"
      ? `Solved in ${activeState.guesses.length}/6`
      : activeState.status === "lost"
        ? "Out of guesses"
        : `Guess ${Math.min(ROWS, activeState.guesses.length + 1)} of ${ROWS}`,
  );
  const dialogTitle = $derived(
    completionSession && activeState.status === "won"
      ? (WIN_PRAISES[activeState.guesses.length - 1] ?? "Well done")
      : completionSession && activeState.status === "lost"
        ? "Out of guesses"
        : "Statistics",
  );
  const dialogDescription = $derived(
    completionSession && activeState.status === "won"
      ? `Solved in ${activeState.guesses.length} of ${ROWS}.`
      : completionSession && activeState.status === "lost"
        ? `The word was ${activeState.targetWord}.`
        : `${store.current.stats.played} games played.`,
  );

  const keyboardLetterStates = $derived.by(() => {
    const letterMap: Record<string, TileState> = {};
    const target = activeState.targetWord;
    for (let row = 0; row < activeState.guesses.length; row += 1) {
      const guess = activeState.guesses[row]!;
      const evaluation = evaluateGuess(guess, target);
      const progress = rowReveals[row]?.current ?? 1;
      for (let col = 0; col < COLS; col += 1) {
        if (tileLocal(progress, col) < 0.5) continue;
        const char = guess[col]!;
        const status = evaluation[col]!;
        const currentBest = letterMap[char];
        if (status === "correct") letterMap[char] = "correct";
        else if (status === "present" && currentBest !== "correct") letterMap[char] = "present";
        else if (!currentBest) letterMap[char] = status;
      }
    }
    return letterMap;
  });

  function tileLocal(progress: number, col: number): number {
    const span = TILE_FLIP_MS / ROW_FLIP_MS;
    const start = (col * TILE_STAGGER) / ROW_FLIP_MS;
    return Math.min(1, Math.max(0, (progress - start) / span));
  }

  function tileRotation(local: number): number {
    if (local <= 0) return 0;
    if (local < 0.5) return local * 180;
    return (1 - local) * 180;
  }

  function tileChar(rowIndex: number, colIndex: number, completedGuess: string | undefined, isCurrentRow: boolean): string {
    if (completedGuess) return completedGuess[colIndex] ?? "";
    if (isCurrentRow) return currentGuess[colIndex] ?? "";
    return "";
  }

  function tileAria(char: string, state: TileState | "", rowIndex: number, colIndex: number): string {
    const slot = `Row ${rowIndex + 1}, column ${colIndex + 1}`;
    if (!char) return `${slot}, empty`;
    if (state === "correct") return `${slot}, ${char}, correct`;
    if (state === "present") return `${slot}, ${char}, in the word`;
    if (state === "absent") return `${slot}, ${char}, not in the word`;
    return `${slot}, ${char}, typed`;
  }

  function keyId(key: string): string {
    if (key === "⌫") return "BACKSPACE";
    return key;
  }

  function keyLabel(key: string): string {
    if (key === "ENTER") return revealing ? "Enter, waiting for tiles" : "Enter";
    if (key === "⌫") return "Backspace";
    const status = keyboardLetterStates[key];
    if (status === "correct") return `${key}, correct`;
    if (status === "present") return `${key}, in the word`;
    if (status === "absent") return `${key}, not in the word`;
    return key;
  }

  function describeEval(guess: string, evaluation: TileState[]): string {
    return evaluation.map((state, index) => {
      const letter = guess[index]!;
      if (state === "correct") return `${letter} correct`;
      if (state === "present") return `${letter} in the word`;
      return `${letter} not in the word`;
    }).join(", ");
  }

  function clearTimer(timer: ReturnType<typeof setTimeout> | null): void {
    if (timer) clearTimeout(timer);
  }

  function showToast(msg: string, duration = 1800): void {
    clearTimer(toastTimer);
    toastMessage = msg;
    toastTimer = setTimeout(() => {
      toastMessage = null;
      toastTimer = null;
    }, duration);
  }

  function announce(msg: string): void {
    announcement = msg;
  }

  function triggerShake(): void {
    if (prefersReducedMotion.current) return;
    shakeRow = true;
    clearTimer(shakeTimer);
    shakeTimer = setTimeout(() => {
      shakeRow = false;
      shakeTimer = null;
    }, 450);
  }

  function afterReveal(callback: () => void): void {
    clearTimer(revealTimer);
    const wait = prefersReducedMotion.current ? 0 : ROW_FLIP_MS + 40;
    revealTimer = setTimeout(() => {
      revealTimer = null;
      callback();
    }, wait);
  }

  function handleKey(raw: string): void {
    if (store.isLoading || revealing) return;
    const c = raw.toUpperCase();
    if (c === "ENTER") {
      if (isGameOver) {
        completionSession = false;
        showStatsModal = true;
        return;
      }
      submitGuess();
      return;
    }
    if (isGameOver) return;
    if (c === "BACKSPACE" || c === "DELETE" || c === "⌫") {
      if (currentGuess.length > 0) currentGuess = currentGuess.slice(0, -1);
      return;
    }
    if (/^[A-Z]$/.test(c) && currentGuess.length < COLS) currentGuess += c;
  }

  function submitGuess(): void {
    if (currentGuess.length < COLS) {
      showToast("Not enough letters");
      announce("Not enough letters.");
      triggerShake();
      return;
    }
    if (!isValidWord(currentGuess)) {
      showToast("Not in word list");
      announce("Not in word list.");
      triggerShake();
      return;
    }

    const guess = currentGuess;
    const game = activeGame();
    const target = game.targetWord;
    const evaluation = evaluateGuess(guess, target);
    currentGuess = "";
    game.guesses.push(guess);

    const won = guess === target;
    const lost = !won && game.guesses.length >= ROWS;
    if (won || lost) {
      game.status = won ? "won" : "lost";
      updateStats(won, game.guesses.length);
    }

    revealing = true;
    afterReveal(() => {
      revealing = false;
      const summary = describeEval(guess, evaluation);
      if (won) {
        const praise = WIN_PRAISES[game.guesses.length - 1] ?? "Well done!";
        showToast(praise, 2400);
        announce(`${summary}. ${praise} Solved in ${game.guesses.length} guesses.`);
        completionSession = true;
        showStatsModal = true;
      } else if (lost) {
        showToast(`The word was ${target}`, 3200);
        announce(`${summary}. Out of guesses. The word was ${target}.`);
        completionSession = true;
        showStatsModal = true;
      } else {
        announce(`${summary}. ${ROWS - game.guesses.length} guesses left.`);
      }
    });
  }

  function activeGame(): GameState {
    return store.current.mode === "daily" ? store.current.daily : store.current.practice;
  }

  function updateStats(won: boolean, guessCount: number): void {
    const stats = store.current.stats;
    stats.played += 1;
    if (won) {
      stats.won += 1;
      stats.currentStreak += 1;
      if (stats.currentStreak > stats.maxStreak) stats.maxStreak = stats.currentStreak;
      const key = String(guessCount);
      stats.guessDistribution[key] = (stats.guessDistribution[key] || 0) + 1;
    } else {
      stats.currentStreak = 0;
    }
  }

  function startNewPractice(): void {
    store.current.practice = {
      targetWord: getRandomWord(),
      guesses: [],
      status: "playing",
    };
    currentGuess = "";
    completionSession = false;
    revealing = false;
    showStatsModal = false;
    showToast("New practice game");
    announce("New practice game.");
  }

  function setMode(mode: "daily" | "practice"): void {
    store.current.mode = mode;
    currentGuess = "";
    completionSession = false;
    revealing = false;
    announce(mode === "daily" ? "Daily puzzle." : "Practice mode.");
  }

  function shareResult(): void {
    const game = activeGame();
    const isDaily = store.current.mode === "daily";
    const score = game.status === "won" ? game.guesses.length : "X";
    const header = isDaily
      ? `hitSlop Wordle (${store.current.daily.date ?? getDailyWord().dateStr}) ${score}/6`
      : `hitSlop Wordle (Practice) ${score}/6`;
    const emojiRows = game.guesses.map((guess) =>
      evaluateGuess(guess, game.targetWord)
        .map((state) => (state === "correct" ? "🟩" : state === "present" ? "🟨" : "⬛"))
        .join(""),
    );
    const shareText = `${header}\n\n${emojiRows.join("\n")}`;
    if (navigator.clipboard) {
      void navigator.clipboard.writeText(shareText);
      showToast("Copied to clipboard!");
      announce("Result copied to clipboard.");
    }
  }

  function onWindowKeyDown(event: KeyboardEvent): void {
    if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
    if (showStatsModal) return;
    const target = event.target;
    const interactive = target instanceof HTMLElement && target.closest("button, [data-button-root], [data-tabs-trigger], [data-dialog-content], input, textarea");
    if (interactive && (event.key === "Enter" || event.key === " ")) return;
    if (event.repeat && event.key !== "Backspace") return;
    if (!/^[a-zA-Z]$/.test(event.key) && event.key !== "Enter" && event.key !== "Backspace") return;
    event.preventDefault();
    handleKey(event.key);
    pressedKey = event.key === "Backspace" ? "BACKSPACE" : event.key === "Enter" ? "ENTER" : event.key.toUpperCase();
  }

  function onWindowKeyUp(event: KeyboardEvent): void {
    const id = event.key === "Backspace" ? "BACKSPACE" : event.key === "Enter" ? "ENTER" : event.key.toUpperCase();
    if (pressedKey === id) pressedKey = null;
  }

  function snapRows(count: number, duration: number): void {
    for (let i = 0; i < ROWS; i += 1) {
      void rowReveals[i]!.set(i < count ? 1 : 0, { duration, delay: 0 });
    }
  }

  $effect(() => { if (store.isReady) ready(); });

  $effect(() => {
    if (!store.isReady) return;
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

  $effect(() => {
    const readyStore = store.isReady;
    const mode = store.current.mode;
    const count = activeState.guesses.length;
    const reduced = prefersReducedMotion.current;
    const modeChanged = lastMode !== null && lastMode !== mode;
    const reset = count < lastGuessCount;
    const instant = !initialized || !readyStore || reduced || modeChanged || reset;
    for (let i = 0; i < ROWS; i += 1) {
      const target = i < count ? 1 : 0;
      const isNewRow = !instant && i === count - 1 && count === lastGuessCount + 1;
      void rowReveals[i]!.set(target, { duration: isNewRow ? ROW_FLIP_MS : 0, delay: 0 });
    }
    lastGuessCount = count;
    lastMode = mode;
    initialized = readyStore;
  });

  onMount(() => {
    window.addEventListener("keydown", onWindowKeyDown);
    window.addEventListener("keyup", onWindowKeyUp);
    const unregister = capture.onPrepare(async () => {
      snapRows(activeState.guesses.length, 0);
      shakeRow = false;
      revealing = false;
      await tick();
    });
    return () => {
      window.removeEventListener("keydown", onWindowKeyDown);
      window.removeEventListener("keyup", onWindowKeyUp);
      unregister();
    };
  });

  onDestroy(() => {
    clearTimer(toastTimer);
    clearTimer(shakeTimer);
    clearTimer(revealTimer);
    snapRows(activeState.guesses.length, 0);
    store.destroy();
  });
</script>

<main class={s.device} data-slop-selection="none" aria-busy={store.isLoading} aria-label="Wordle puzzle chassis">
  <header class={s.topNav}>
    <div class={s.navGroup}>
      <div class={s.brandTitle}>
        <span class={s.brandDot}></span>
        <span>WORDLE</span>
      </div>
    </div>
    <div class={s.navGroup} data-slop-export="hide">
      <Tabs.Root
        value={store.current.mode}
        onValueChange={(value) => { if (value === "daily" || value === "practice") setMode(value); }}
      >
        <Tabs.List class={s.modeList} aria-label="Game mode">
          <Tabs.Trigger value="daily">Daily</Tabs.Trigger>
          <Tabs.Trigger value="practice">Practice</Tabs.Trigger>
        </Tabs.List>
      </Tabs.Root>
      {#if store.current.mode === "practice"}
        <Button.Root type="button" class={s.iconBtn} aria-label="New practice game" onclick={startNewPractice}>
          <RotateCcw size={15} />
        </Button.Root>
      {/if}
      <Button.Root
        type="button"
        class={s.iconBtn}
        aria-label="Statistics"
        onclick={() => { completionSession = false; showStatsModal = true; }}
      >
        <BarChart3 size={15} />
      </Button.Root>
    </div>
  </header>

  {#if toastMessage}
    <div class={s.toastWrap} aria-hidden="true">
      <div class={s.toast}>{toastMessage}</div>
    </div>
  {/if}
  <div class={s.srOnly} aria-live="polite" aria-atomic="true">{announcement}</div>

  <div class={s.boardWrap}>
    <div class={s.statusLine} aria-hidden="true">{statusLine}</div>
    <div class={s.grid} role="grid" aria-label="Wordle 6 by 5 game board">
      {#each Array(ROWS) as _, rowIndex}
        {@const completedGuess = activeState.guesses[rowIndex]}
        {@const isCurrentRow = !isGameOver && rowIndex === activeState.guesses.length}
        {@const evaluation = completedGuess ? evaluateGuess(completedGuess, activeState.targetWord) : null}
        {@const progress = rowReveals[rowIndex]!.current}
        <div class={`${s.row} ${isCurrentRow && shakeRow ? s.rowShake : ""}`} role="row">
          {#each Array(COLS) as _, colIndex}
            {@const char = tileChar(rowIndex, colIndex, completedGuess, isCurrentRow)}
            {@const local = completedGuess ? tileLocal(progress, colIndex) : 0}
            {@const revealed = Boolean(completedGuess) && local >= 0.5}
            {@const state = revealed && evaluation ? evaluation[colIndex] ?? "" : ""}
            <div
              class={s.tile}
              data-filled={Boolean(char)}
              data-pop={Boolean(char) && isCurrentRow && !prefersReducedMotion.current}
              data-state={state}
              style:transform={`rotateX(${tileRotation(local)}deg)`}
              role="gridcell"
              aria-label={tileAria(char, state, rowIndex, colIndex)}
            >
              {char}
            </div>
          {/each}
        </div>
      {/each}
    </div>
  </div>

  <footer class={s.keyboard} aria-label="On-screen keyboard" data-slop-export="hide">
    {#each KEYBOARD_ROWS as keys}
      <div class={s.keyboardRow}>
        {#each keys as key}
          {@const id = keyId(key)}
          {@const status = id.length === 1 ? (keyboardLetterStates[id] ?? "") : ""}
          <button
            type="button"
            class={s.key}
            data-wide={key === "ENTER" || key === "⌫"}
            data-state={status}
            data-pressed={pressedKey === id}
            aria-label={keyLabel(key)}
            aria-keyshortcuts={id === "BACKSPACE" ? "Backspace" : id === "ENTER" ? "Enter" : id}
            onpointerdown={() => { pressedKey = id; }}
            onpointerup={() => { if (pressedKey === id) pressedKey = null; }}
            onpointerleave={() => { if (pressedKey === id) pressedKey = null; }}
            onpointercancel={() => { if (pressedKey === id) pressedKey = null; }}
            onclick={() => handleKey(id)}
          >
            {key}
          </button>
        {/each}
      </div>
    {/each}
  </footer>

  {#if store.error}
    <div class={s.error} role="alert">
      <span>{store.isReady ? "Changes haven’t been saved." : "Your puzzle couldn’t be loaded."} {store.error}</span>
      <Button.Root type="button" data-slop-export="hide" onclick={() => { if (store.isReady) void store.flush().catch(() => undefined); else void store.reload(); }}>Try again</Button.Root>
    </div>
  {:else if store.isLoading}
    <p class={s.error} role="status">Loading your puzzle…</p>
  {/if}
</main>

<Dialog.Root bind:open={showStatsModal}>
  <Dialog.Portal>
    <Dialog.Overlay class={s.dialogOverlay} data-slop-export="hide" />
    <Dialog.Content class={s.dialogCard} aria-labelledby="stats-title" aria-describedby="stats-copy" data-slop-export="hide">
      <div class={s.dialogHead}>
        <Dialog.Title id="stats-title"><h2>{dialogTitle}</h2></Dialog.Title>
        <Dialog.Close class={s.dialogClose} aria-label="Close statistics"><X size={16} /></Dialog.Close>
      </div>
      <Dialog.Description id="stats-copy" class={s.dialogCopy}>{dialogDescription}</Dialog.Description>

      <div class={s.statsGrid}>
        <div class={s.statItem}>
          <span class={s.statValue}>{store.current.stats.played}</span>
          <span class={s.statLabel}>Played</span>
        </div>
        <div class={s.statItem}>
          <span class={s.statValue}>{winPercent}%</span>
          <span class={s.statLabel}>Win %</span>
        </div>
        <div class={s.statItem}>
          <span class={s.statValue}>{store.current.stats.currentStreak}</span>
          <span class={s.statLabel}>Current Streak</span>
        </div>
        <div class={s.statItem}>
          <span class={s.statValue}>{store.current.stats.maxStreak}</span>
          <span class={s.statLabel}>Max Streak</span>
        </div>
      </div>

      <div>
        <div class={s.distTitle}>Guess Distribution</div>
        <div class={s.distRows}>
          {#each [1, 2, 3, 4, 5, 6] as guessNum}
            {@const count = store.current.stats.guessDistribution[String(guessNum)] || 0}
            {@const maxCount = Math.max(1, ...Object.values(store.current.stats.guessDistribution))}
            {@const percent = Math.round((count / maxCount) * 100)}
            {@const isCurrentWinGuess = isGameOver && activeState.status === "won" && activeState.guesses.length === guessNum}
            <div class={s.distRow}>
              <span class={s.distIdx}>{guessNum}</span>
              <Progress.Root class={s.distTrack} value={count} max={maxCount} aria-label={`Guessed in ${guessNum}: ${count}`}>
                <div class={s.distBar} data-highlight={isCurrentWinGuess} style:width={`${Math.max(8, percent)}%`}>{count}</div>
              </Progress.Root>
            </div>
          {/each}
        </div>
      </div>

      <div class={s.dialogActions}>
        {#if isGameOver}
          <Button.Root type="button" class={`${s.actionBtn} ${s.actionPrimary}`} onclick={shareResult}>
            <Share2 size={14} />
            <span>Share Result</span>
          </Button.Root>
        {/if}
        {#if store.current.mode === "practice"}
          <Button.Root type="button" class={`${s.actionBtn} ${s.actionSecondary}`} onclick={startNewPractice}>
            <RotateCcw size={14} />
            <span>New Word</span>
          </Button.Root>
        {/if}
      </div>
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>

<IconTarget>
  <Icon guesses={activeState.guesses.length} status={activeState.status} />
</IconTarget>
<ExportTarget>
  <Export data={store.current} currentGuess={currentGuess} />
</ExportTarget>
